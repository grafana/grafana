import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Icon, IconButton, useStyles2 } from '@grafana/ui';

import { QueryFlowCanvas } from './QueryFlowCanvas';
import { ParseStatusBadge } from './components/ParseStatusBadge';
import { type QueryFlowDiagnostic } from './diagnostics/types';
import { type NodeEnrichment } from './enrichment/types';
import { layoutGraph } from './layout';
import { type QueryFlowGraph, type QueryFlowStatus } from './model/types';

interface Props {
  graph?: QueryFlowGraph;
  status: QueryFlowStatus;
  refId: string;
  diagnostics?: QueryFlowDiagnostic[];
  onClose: () => void;
  /** Lookup for a node's live enrichment, once requested. */
  getEnrichment?: (nodeId: string) => NodeEnrichment | undefined;
  /** Lazily fetch a node's enrichment — wired to each node's hover/focus. */
  onRequestEnrichment?: (nodeId: string) => void;
  /** Called with a node id on hover (or `null` on leave) to highlight its text in the editor. */
  onNodeHover?: (nodeId: string | null) => void;
}

export function QueryFlowPanel({
  graph,
  status,
  refId,
  diagnostics,
  onClose,
  getEnrichment,
  onRequestEnrichment,
  onNodeHover,
}: Props) {
  const styles = useStyles2(getStyles);
  const layout = useMemo(() => (graph ? layoutGraph(graph) : undefined), [graph]);
  const hasNodes = !!layout && layout.nodes.length > 0;
  // Split so errors/warnings (things that are likely wrong) read distinctly from tips (optional
  // best-practice nudges) — lumping them into one "N suggestions" count understated real problems.
  const errorCount = diagnostics?.filter((d) => d.severity === 'error' || d.severity === 'warning').length ?? 0;
  const tipCount = diagnostics?.filter((d) => d.severity === 'tip').length ?? 0;

  return (
    <div className={styles.container} data-testid="query-flow">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Icon name="sitemap" />
          <span className={styles.title}>
            <Trans i18nKey="explore.query-flow.title">Query flow</Trans>
          </span>
          <span className={styles.refId}>{refId}</span>
          <ParseStatusBadge status={status} />
          {hasNodes && errorCount > 0 && (
            <Badge
              color="red"
              icon="exclamation-circle"
              text={t('explore.query-flow.issue-count', '', {
                count: errorCount,
                defaultValue_one: '{{count}} issue',
                defaultValue_other: '{{count}} issues',
              })}
            />
          )}
          {hasNodes && tipCount > 0 && (
            <span className={styles.issues}>
              {t('explore.query-flow.tip-count', '', {
                count: tipCount,
                defaultValue_one: '{{count}} tip',
                defaultValue_other: '{{count}} tips',
              })}
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          <IconButton
            name="times"
            aria-label={t('explore.query-flow.close', 'Close query flow')}
            tooltip={t('explore.query-flow.close', 'Close query flow')}
            onClick={onClose}
          />
        </div>
      </div>

      <div className={styles.body}>
        {status === 'unsupported' ? (
          <div className={styles.message}>
            <Trans i18nKey="explore.query-flow.unsupported">
              Query flow currently supports Prometheus and Loki queries.
            </Trans>
          </div>
        ) : !hasNodes ? (
          <div className={styles.message}>
            <Trans i18nKey="explore.query-flow.empty">
              Enter a Prometheus or Loki query to see how it breaks down.
            </Trans>
          </div>
        ) : (
          <QueryFlowCanvas
            layout={layout}
            diagnostics={diagnostics}
            getEnrichment={getEnrichment}
            onRequestEnrichment={onRequestEnrichment}
            onNodeHover={onNodeHover}
          />
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  titleRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  title: css({
    fontWeight: theme.typography.fontWeightMedium,
  }),
  refId: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    padding: theme.spacing(0, 0.75),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  issues: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  headerRight: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  body: css({
    position: 'relative',
    flex: 1,
    minHeight: 0,
  }),
  message: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.text.secondary,
  }),
});
