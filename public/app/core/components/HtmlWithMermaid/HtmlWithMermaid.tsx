import { css } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { type HTMLAttributes, useEffect, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { DIAGRAM_CLASS, DIAGRAM_ERROR_CLASS, renderMermaidDiagrams } from 'app/core/utils/mermaid';

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Sanitized HTML; this component is not an XSS boundary. */
  html: string;
  /** Turn ```mermaid fences and <pre class="mermaid"> blocks into themed diagrams. */
  diagrams?: boolean;
}

/** Injects pre-sanitized HTML and draws the mermaid diagrams in it. */
export function HtmlWithMermaid({ html, diagrams = true, ...rest }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const ref = useRef<HTMLDivElement>(null);

  // allowRerender rebuilds the DOM on every html change, and mermaid.initialize
  // is global, so diagrams are re-drawn per change and per theme flip.
  useEffect(() => {
    const container = ref.current;
    if (!diagrams || !container) {
      return;
    }

    // Never rejects: import and per-diagram failures are reported in place.
    const controller = new AbortController();
    void renderMermaidDiagrams(container, theme, controller.signal);

    return () => controller.abort();
  }, [html, diagrams, theme]);

  return (
    // display:contents so this wrapper adds no box of its own.
    <div ref={ref} className={styles.host}>
      {/* Empty content is valid, but DangerouslySetHtmlContent rejects empty html. */}
      {html && <DangerouslySetHtmlContent allowRerender html={html} {...rest} />}
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
