import { css } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useEffect, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { DIAGRAM_CLASS, DIAGRAM_ERROR_CLASS, renderMermaidDiagrams } from './mermaid';

interface Props {
  html: string;
  className?: string;
  testId?: string;
}

/** Shared by the panel and the edit-time preview so they can't diverge. */
export function TextNGHtmlView({ html, className, testId }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const ref = useRef<HTMLDivElement>(null);

  // allowRerender rebuilds the DOM on every html change, and mermaid.initialize
  // is global, so diagrams are re-drawn per change and per theme flip.
  useEffect(() => {
    const container = ref.current;
    if (!container) {
      return;
    }

    // Per-diagram failures are already reported in place.
    const controller = new AbortController();
    renderMermaidDiagrams(container, theme, controller.signal).catch(() => {});

    return () => controller.abort();
  }, [html, theme]);

  return (
    // display:contents so this wrapper adds no box of its own.
    <div ref={ref} className={styles.host}>
      <DangerouslySetHtmlContent allowRerender html={html} className={className} data-testid={testId} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  host: css({
    display: 'contents',

    [`.${DIAGRAM_CLASS} svg`]: {
      maxWidth: '100%',
      height: 'auto',
    },
    [`.${DIAGRAM_ERROR_CLASS}`]: {
      color: theme.colors.error.text,
      marginBottom: theme.spacing(0.5),
    },
  }),
});
