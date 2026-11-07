import { css } from '@emotion/css';
import {
  createContext,
  useContext,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';

import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Alert, type AlertVariant } from '../Alert/Alert';

const kinds = ['note', 'tip', 'important', 'warning', 'caution'] as const;
type Kind = (typeof kinds)[number];
const TitlesContext = createContext<Record<Kind, string> | undefined>(undefined);
const selector = kinds.map((kind) => `blockquote.grafana-markdown-alert-${kind}`).join(',');
const severity: Record<Kind, AlertVariant> = {
  note: 'info',
  tip: 'success',
  important: 'info',
  warning: 'warning',
  caution: 'error',
};
const admonitionBodyStyles = css({ '& a': { textDecoration: 'underline' } });

export function getMarkdownAlertTitles(): Record<Kind, string> {
  return {
    note: t('grafana-ui.markdown.note', 'Note'),
    tip: t('grafana-ui.markdown.tip', 'Tip'),
    important: t('grafana-ui.markdown.important', 'Important'),
    warning: t('grafana-ui.markdown.warning', 'Warning'),
    caution: t('grafana-ui.markdown.caution', 'Caution'),
  };
}

interface Admonition {
  target: HTMLElement;
  kind: Kind;
  body: HTMLElement;
}

export interface MarkdownHTMLProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'dangerouslySetInnerHTML'> {
  /** Rendered HTML is sanitized before insertion. */
  html: string;
  /** Use the HTML policy for content that needs relative links and data attributes. */
  sanitization?: 'markdown' | 'html';
  ref?: Ref<HTMLDivElement>;
}

/** Displays rendered Markdown, upgrading admonitions to themed Grafana Alerts. */
export function MarkdownHTML({ html, sanitization = 'markdown', ...props }: MarkdownHTMLProps) {
  const safeHtml = useMemo(
    () => (sanitization === 'html' ? textUtil.sanitize(html) : textUtil.sanitizeTextPanelContent(html)),
    [html, sanitization]
  );
  const innerHtml = useMemo(() => ({ __html: safeHtml }), [safeHtml]);
  if (!safeHtml.includes('grafana-markdown-alert-')) {
    return <div {...props} dangerouslySetInnerHTML={innerHtml} />;
  }
  // Changing HTML remounts its portals together with their targets, avoiding stale DOM ownership.
  return <MarkdownDocument key={safeHtml} html={safeHtml} {...props} />;
}

function MarkdownDocument({ html, ref, ...props }: MarkdownHTMLProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const innerHtml = useMemo(() => ({ __html: html }), [html]);
  const attach = useCallback((node: HTMLDivElement | null) => {
    host.current = node;
    setContainer(node);
  }, []);
  useImperativeHandle(ref, () => host.current!, []);
  return (
    <>
      <div {...props} ref={attach} dangerouslySetInnerHTML={innerHtml} />
      <MarkdownAdmonitions container={container} />
    </>
  );
}

/** Adds Alerts to an existing HTML host, including isolated Text panel documents. */
export function MarkdownAdmonitions({
  container,
  titles: suppliedTitles,
}: {
  container: HTMLElement | null;
  titles?: Record<Kind, string>;
}) {
  const inheritedTitles = useContext(TitlesContext);
  const titles = suppliedTitles ?? inheritedTitles ?? getMarkdownAlertTitles();
  const [admonitions, setAdmonitions] = useState<Admonition[]>([]);
  useLayoutEffect(() => {
    if (!container) {
      return;
    }
    const replacements: Array<{ original: Element; target: HTMLElement }> = [];
    const alerts: Admonition[] = [];
    for (const original of container.querySelectorAll(selector)) {
      // Nested alerts are upgraded recursively by the body renderer.
      const ancestor = original.parentElement?.closest(selector);
      if (ancestor && container.contains(ancestor)) {
        continue;
      }
      const body = original.querySelector<HTMLElement>(':scope > .grafana-markdown-alert-body');
      const kind = kinds.find((kind) => original.classList.contains(`grafana-markdown-alert-${kind}`));
      if (!body || !kind) {
        continue;
      }
      const target = container.ownerDocument.createElement('div');
      original.replaceWith(target);
      replacements.push({ original, target });
      alerts.push({ target, kind, body });
    }
    setAdmonitions(alerts);
    return () => {
      for (const { original, target } of replacements) {
        target.replaceWith(original);
      }
    };
  }, [container]);

  return (
    <TitlesContext.Provider value={titles}>
      {admonitions.map(({ target, kind, body }, index) =>
        createPortal(
          <Alert title={titles[kind]} severity={severity[kind]}>
            <AdmonitionBody body={body} />
          </Alert>,
          target,
          String(index)
        )
      )}
    </TitlesContext.Provider>
  );
}

function AdmonitionBody({ body }: { body: HTMLElement }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const parent = body.parentElement;
    // Move existing nodes so diagram rendering and delegated links keep their DOM references.
    host.current?.append(body);
    return () => {
      parent?.append(body);
    };
  }, [body]);
  return (
    <>
      <div ref={host} className={admonitionBodyStyles} />
      <MarkdownAdmonitions container={body} />
    </>
  );
}
