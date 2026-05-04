import { css } from '@emotion/css';
import { Fragment, type ReactNode } from 'react';

import { renderMarkdown, type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type PulseBody, type PulseBodyNode, type PulseMention } from '../types';
import { isSafeUrl } from '../utils/body';

import { MentionChip } from './MentionChip';

interface Props {
  body: PulseBody;
  onMentionClick?: (mention: PulseMention) => void;
}

/**
 * PulseRenderer renders a body to React nodes. New bodies carry a
 * `markdown` source which we render through Grafana's renderMarkdown
 * (xss + DOMPurify sanitized via sanitizeTextPanelContent). Older
 * bodies only carry the validated AST; we walk those node-by-node so
 * we never call dangerouslySetInnerHTML on unsanitized content.
 */
export function PulseRenderer({ body, onMentionClick }: Props): ReactNode {
  const styles = useStyles2(getStyles);
  if (!body) {
    return null;
  }
  if (typeof body.markdown === 'string' && body.markdown.length > 0) {
    // renderMarkdown returns sanitized HTML; the surrounding `<div>` is
    // styled to scope mention-style inline-code rendering to the pulse
    // body so we don't bleed into the rest of the page.
    const html = renderMarkdown(body.markdown);
    return <div className={styles.markdown} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (!body.root) {
    return null;
  }
  return <RenderNode node={body.root} onMentionClick={onMentionClick} />;
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
  }),
});

interface NodeProps {
  node: PulseBodyNode;
  onMentionClick?: (mention: PulseMention) => void;
}

function RenderNode({ node, onMentionClick }: NodeProps): ReactNode {
  switch (node.type) {
    case 'root':
      return (
        <>
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </>
      );

    case 'paragraph':
      return (
        <p style={{ margin: '0 0 0.5em' }}>
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </p>
      );

    case 'quote':
      return (
        <blockquote style={{ borderLeft: '3px solid currentColor', margin: 0, paddingLeft: '0.75em', opacity: 0.8 }}>
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </blockquote>
      );

    case 'code':
      return (
        <code style={{ background: 'rgba(127,127,127,0.15)', padding: '0 4px', borderRadius: 3 }}>
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
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
      return <MentionChip mention={node.mention} onClick={onMentionClick} />;

    case 'link': {
      const safe = isSafeUrl(node.url ?? '');
      if (!safe) {
        // Render the children as plain text rather than as a link so a
        // malicious URL cannot become a navigable anchor.
        return (
          <Fragment>
            {node.children?.map((c, i) => (
              <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
            ))}
          </Fragment>
        );
      }
      return (
        <a href={safe} target="_blank" rel="noopener noreferrer">
          {node.children?.map((c, i) => (
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
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
            <RenderNode key={i} node={c} onMentionClick={onMentionClick} />
          ))}
        </Fragment>
      );
  }
}
