import { css } from '@emotion/css';
import { Fragment, type ReactNode, useEffect, useRef } from 'react';

import { renderMarkdown, type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type PulseBody, type PulseBodyNode, type PulseMention } from '../types';
import {
  collectMentions,
  isSafeUrl,
  rewritePanelMentionsInMarkdown,
  rewriteTimeMentionsInMarkdown,
} from '../utils/body';

import { MentionChip } from './MentionChip';

interface Props {
  body: PulseBody;
  onMentionClick?: (mention: PulseMention) => void;
  /**
   * Live panel-id → title map for the dashboard this body is rendered
   * inside. Used to keep panel mention chips in sync with the current
   * panel name even after a rename. Optional — surfaces without a
   * dashboard context (e.g. notification previews) just keep the
   * historical displayName.
   */
  panelTitlesById?: ReadonlyMap<number, string>;
  /**
   * UID of the dashboard this thread belongs to. When set, `time`
   * mention chips render as anchor tags that navigate to the
   * dashboard with the chip's frozen `from`/`to` applied. Omit on
   * surfaces with no dashboard target (notification previews) — the
   * chip then falls back to a static label.
   */
  dashboardUID?: string;
  /**
   * Optional handler invoked when the reader clicks a `time` mention
   * chip. When provided, the renderer suppresses the chip's default
   * anchor navigation (for plain clicks) and routes through this
   * callback so the surrounding dashboard's time picker can update
   * in place. Cmd/Ctrl-click is left alone so users can still open
   * the time-pinned URL in a new tab. Omit on surfaces with no
   * mounted dashboard (global Pulse overview, notification
   * previews) — the chip then navigates via its anchor as usual.
   */
  onTimeChipClick?: (from: number, to: number) => void;
}

/**
 * PulseRenderer renders a body to React nodes. New bodies carry a
 * `markdown` source which we render through Grafana's renderMarkdown
 * (xss + DOMPurify sanitized via sanitizeTextPanelContent). Older
 * bodies only carry the validated AST; we walk those node-by-node so
 * we never call dangerouslySetInnerHTML on unsanitized content.
 */
export function PulseRenderer({
  body,
  onMentionClick,
  panelTitlesById,
  dashboardUID,
  onTimeChipClick,
}: Props): ReactNode {
  const styles = useStyles2(getStyles);

  // Delegated native click listener for the markdown render path.
  // The chip itself is a real anchor (so keyboard activation /
  // cmd-click / right-click "open in new tab" all just work via the
  // browser); the wrapper only intercepts plain left-clicks to
  // reroute them through the SceneTimeRange callback. Going through
  // a ref + addEventListener (instead of a JSX onClick on the div)
  // sidesteps the a11y lint that wants a keyboard handler on
  // interactive divs — the div isn't interactive, the anchors
  // inside it are.
  const markdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = markdownRef.current;
    if (!el || !onTimeChipClick) {
      return undefined;
    }
    const handler = (e: globalThis.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      const target = e.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const anchor = target.closest('a');
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute('href') ?? '';
      const parsed = parseTimeChipHref(href);
      if (!parsed) {
        return;
      }
      e.preventDefault();
      onTimeChipClick(parsed.from, parsed.to);
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onTimeChipClick]);

  if (!body) {
    return null;
  }
  if (typeof body.markdown === 'string' && body.markdown.length > 0) {
    // Mentions render as inline-code tokens (`` `#PanelName` ``) inside
    // the markdown source. Rewrite the source so renamed panels render
    // their current title — the AST mention sidecar tells us which
    // tokens were panel chips at compose time, so we don't risk
    // touching unrelated backticked text. Time chips get a second
    // rewrite that turns them into navigable anchor tags scoped to
    // the source dashboard.
    const mentions = collectMentions(body);
    let source = body.markdown;
    if (panelTitlesById && panelTitlesById.size > 0) {
      source = rewritePanelMentionsInMarkdown(source, mentions, panelTitlesById);
    }
    if (dashboardUID) {
      source = rewriteTimeMentionsInMarkdown(source, mentions, dashboardUID);
    }
    // renderMarkdown returns sanitized HTML; the surrounding `<div>` is
    // styled to scope mention-style inline-code rendering to the pulse
    // body so we don't bleed into the rest of the page.
    const html = renderMarkdown(source);
    return <div ref={markdownRef} className={styles.markdown} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (!body.root) {
    return null;
  }
  return (
    <RenderNode
      node={body.root}
      onMentionClick={onMentionClick}
      panelTitlesById={panelTitlesById}
      dashboardUID={dashboardUID}
      onTimeChipClick={onTimeChipClick}
    />
  );
}

/**
 * parseTimeChipHref reverses timeChipHref. Returns the `from`/`to`
 * encoded in an anchor's href when (and only when) it matches the
 * shape we produce ourselves; any other URL — including hostile or
 * unrelated `/d/...` links — yields undefined so the delegated
 * click handler stays a no-op for non-chip clicks.
 */
function parseTimeChipHref(href: string): { from: number; to: number } | undefined {
  if (!href.startsWith('/d/')) {
    return undefined;
  }
  const queryStart = href.indexOf('?');
  if (queryStart < 0) {
    return undefined;
  }
  const params = new URLSearchParams(href.slice(queryStart + 1));
  const fromStr = params.get('from');
  const toStr = params.get('to');
  if (!fromStr || !toStr) {
    return undefined;
  }
  const from = Number(fromStr);
  const to = Number(toStr);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0 || from >= to) {
    return undefined;
  }
  return { from, to };
}

const getStyles = (theme: GrafanaTheme2) => ({
  markdown: css({
    '& p': {
      margin: '0 0 0.5em',
    },
    '& p:last-child': {
      marginBottom: 0,
    },
    '& code': {
      background: theme.colors.warning.transparent,
      color: theme.colors.warning.text,
      padding: '0 4px',
      borderRadius: theme.shape.radius.default,
      fontSize: theme.typography.bodySmall.fontSize,
    },
    '& pre': {
      background: theme.colors.background.canvas,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      overflowX: 'auto',
    },
    '& pre code': {
      background: 'transparent',
      color: 'inherit',
      padding: 0,
      borderRadius: 'unset',
    },
    '& blockquote': {
      borderLeft: `3px solid ${theme.colors.border.medium}`,
      margin: '0 0 0.5em',
      padding: theme.spacing(0, 1),
      color: theme.colors.text.secondary,
    },
    '& ul, & ol': {
      margin: '0 0 0.5em',
      paddingLeft: theme.spacing(3),
    },
    '& a': {
      color: theme.colors.primary.text,
      textDecoration: 'underline',
    },
    // Time chips render as `<a><code>@<label></code></a>`. The chip
    // styling on `<code>` already provides the affordance, so suppress
    // the link's underline and let the code's color/background win.
    // Hover keeps the underline so the link nature stays discoverable.
    '& a code': {
      textDecoration: 'none',
    },
    '& a:has(code)': {
      textDecoration: 'none',
    },
    '& a:hover code': {
      textDecoration: 'underline',
    },
  }),
});

interface NodeProps {
  node: PulseBodyNode;
  onMentionClick?: (mention: PulseMention) => void;
  panelTitlesById?: ReadonlyMap<number, string>;
  dashboardUID?: string;
  onTimeChipClick?: (from: number, to: number) => void;
}

function RenderNode({ node, onMentionClick, panelTitlesById, dashboardUID, onTimeChipClick }: NodeProps): ReactNode {
  switch (node.type) {
    case 'root':
      return (
        <>
          {node.children?.map((c, i) => (
            <RenderNode
              key={i}
              node={c}
              onMentionClick={onMentionClick}
              panelTitlesById={panelTitlesById}
              dashboardUID={dashboardUID}
              onTimeChipClick={onTimeChipClick}
            />
          ))}
        </>
      );

    case 'paragraph':
      return (
        <p style={{ margin: '0 0 0.5em' }}>
          {node.children?.map((c, i) => (
            <RenderNode
              key={i}
              node={c}
              onMentionClick={onMentionClick}
              panelTitlesById={panelTitlesById}
              dashboardUID={dashboardUID}
              onTimeChipClick={onTimeChipClick}
            />
          ))}
        </p>
      );

    case 'quote':
      return (
        <blockquote style={{ borderLeft: '3px solid currentColor', margin: 0, paddingLeft: '0.75em', opacity: 0.8 }}>
          {node.children?.map((c, i) => (
            <RenderNode
              key={i}
              node={c}
              onMentionClick={onMentionClick}
              panelTitlesById={panelTitlesById}
              dashboardUID={dashboardUID}
              onTimeChipClick={onTimeChipClick}
            />
          ))}
        </blockquote>
      );

    case 'code':
      return (
        <code style={{ background: 'rgba(127,127,127,0.15)', padding: '0 4px', borderRadius: 3 }}>
          {node.children?.map((c, i) => (
            <RenderNode
              key={i}
              node={c}
              onMentionClick={onMentionClick}
              panelTitlesById={panelTitlesById}
              dashboardUID={dashboardUID}
              onTimeChipClick={onTimeChipClick}
            />
          ))}
        </code>
      );

    case 'linebreak':
      return <br />;

    case 'text':
      return <Fragment>{node.text ?? ''}</Fragment>;

    case 'mention':
      if (!node.mention) {
        return null;
      }
      return (
        <MentionChip
          mention={node.mention}
          onClick={onMentionClick}
          panelTitlesById={panelTitlesById}
          dashboardUID={dashboardUID}
          onTimeChipClick={onTimeChipClick}
        />
      );

    case 'link': {
      const safe = isSafeUrl(node.url ?? '');
      if (!safe) {
        // Render the children as plain text rather than as a link so a
        // malicious URL cannot become a navigable anchor.
        return (
          <Fragment>
            {node.children?.map((c, i) => (
              <RenderNode
                key={i}
                node={c}
                onMentionClick={onMentionClick}
                panelTitlesById={panelTitlesById}
                dashboardUID={dashboardUID}
                onTimeChipClick={onTimeChipClick}
              />
            ))}
          </Fragment>
        );
      }
      return (
        <a href={safe} target="_blank" rel="noopener noreferrer">
          {node.children?.map((c, i) => (
            <RenderNode
              key={i}
              node={c}
              onMentionClick={onMentionClick}
              panelTitlesById={panelTitlesById}
              dashboardUID={dashboardUID}
              onTimeChipClick={onTimeChipClick}
            />
          ))}
        </a>
      );
    }

    default:
      // Unknown node types degrade to their children rendered as text;
      // never inject HTML.
      return (
        <Fragment>
          {node.children?.map((c, i) => (
            <RenderNode
              key={i}
              node={c}
              onMentionClick={onMentionClick}
              panelTitlesById={panelTitlesById}
              dashboardUID={dashboardUID}
              onTimeChipClick={onTimeChipClick}
            />
          ))}
        </Fragment>
      );
  }
}
