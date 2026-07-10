import { css } from '@emotion/css';
import { memo } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { type DiagnosticSeverity, type QueryFlowDiagnostic } from '../diagnostics/types';
import { NODE_WIDTH } from '../layout';

interface Point {
  x: number;
  y: number;
}

interface Props {
  diagnostics: QueryFlowDiagnostic[];
  /** Live top-left positions of each node, keyed by node id. */
  positions: Record<string, Point>;
}

// Gap between a callout stack and the top of its node.
const ANCHOR_GAP = 10;

const SEVERITY_ICON: Record<DiagnosticSeverity, IconName> = {
  error: 'exclamation-circle',
  warning: 'exclamation-triangle',
  tip: 'info-circle',
};

// `diagnostics`/`positions` are stable references upstream unless they actually change, so this
// skips re-rendering all callouts when the canvas re-renders for unrelated reasons.
export const QueryFlowAnnotations = memo(function QueryFlowAnnotations({ diagnostics, positions }: Props) {
  const styles = useStyles2(getStyles);

  const byNode = new Map<string, QueryFlowDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    const list = byNode.get(diagnostic.nodeId);
    if (list) {
      list.push(diagnostic);
    } else {
      byNode.set(diagnostic.nodeId, [diagnostic]);
    }
  }

  return (
    <>
      {Array.from(byNode.entries()).map(([nodeId, items]) => {
        const pos = positions[nodeId];
        if (!pos) {
          return null;
        }
        return (
          <div
            key={nodeId}
            className={styles.stack}
            style={{ left: pos.x, top: pos.y - ANCHOR_GAP }}
            data-testid="query-flow-annotation"
          >
            {items.map((item) => (
              <Callout key={item.id} diagnostic={item} />
            ))}
          </div>
        );
      })}
    </>
  );
});

function Callout({ diagnostic }: { diagnostic: QueryFlowDiagnostic }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles[diagnostic.severity]}>
      <Icon name={SEVERITY_ICON[diagnostic.severity]} size="sm" className={styles.icon} />
      <div className={styles.text}>
        <span>{diagnostic.message}</span>
        {diagnostic.suggestion && <code className={styles.suggestion}>{diagnostic.suggestion}</code>}
      </div>
      {diagnostic.docsHref && <CalloutDocsLink href={diagnostic.docsHref} />}
    </div>
  );
}

function CalloutDocsLink({ href }: { href: string }) {
  const styles = useStyles2(getStyles);
  const label = t('explore.query-flow.open-docs', 'Open documentation');
  return (
    <Tooltip content={label}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={styles.docs}
        aria-label={label}
        data-testid="query-flow-annotation-docs"
        onClick={() => reportInteraction('grafana_explore_query_flow_docs_click', { source: 'callout' })}
      >
        <Icon name="book" size="sm" />
      </a>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  // Plain-text annotation row: an icon plus wrapping text, no card chrome. A faint canvas-colored
  // backdrop keeps it legible where it overlaps edges, without reading as another node.
  const row = css({
    display: 'flex',
    gap: theme.spacing(0.5),
    width: '100%',
    padding: theme.spacing(0.25, 0.5),
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    background: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
  });

  return {
    // Anchored so its bottom sits ANCHOR_GAP above the node top; rendered inside the zoom/pan layer.
    stack: css({
      position: 'absolute',
      maxWidth: NODE_WIDTH,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.25),
      transform: 'translateY(-100%)',
      pointerEvents: 'none',
    }),
    icon: css({
      flexShrink: 0,
      marginTop: 2,
    }),
    // The `.stack` container disables pointer events so callouts don't block dragging/clicking the
    // canvas underneath; re-enable them for the link specifically so it's actually clickable.
    docs: css({
      display: 'inline-flex',
      flexShrink: 0,
      alignSelf: 'flex-start',
      pointerEvents: 'auto',
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    text: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.25),
      minWidth: 0,
    }),
    suggestion: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      background: theme.colors.background.secondary,
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.default,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      alignSelf: 'flex-start',
    }),
    error: css(row, {
      color: theme.colors.error.text,
    }),
    warning: css(row, {
      color: theme.colors.warning.text,
    }),
    tip: css(row, {
      color: theme.colors.text.secondary,
    }),
  };
};
