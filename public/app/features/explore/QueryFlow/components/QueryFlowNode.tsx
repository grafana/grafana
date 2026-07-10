import { css } from '@emotion/css';
import { memo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Icon, IconButton, Spinner, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';

import { docsLinkFor } from '../docs/docsLinks';
import { type NodeEnrichment } from '../enrichment/types';
import { NODE_MAX_PARAM_ROWS, NODE_WIDTH } from '../layout';
import { KIND_META, getNodeAccentColor } from '../model/nodeColors';
import { type QueryFlowNode as QueryFlowNodeModel, QueryFlowNodeKind } from '../model/types';

// label name + operator (=, !=, =~, !~) + value, e.g. `cluster="$cluster"`.
const MATCHER_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!=|!~|=)(.*)$/s;

interface Props {
  node: QueryFlowNodeModel;
  /** Rendered card height from the layout (keeps the card in sync with the reserved slot). */
  height: number;
  /** Live enrichment for this node, once requested. */
  enrichment?: NodeEnrichment;
  /** Called on hover/focus to lazily fetch this node's enrichment. */
  onRequest?: () => void;
  /** Called when the pointer enters the card — used to highlight the node's text in the editor. */
  onHoverStart?: () => void;
  /** Called when the pointer leaves the card — used to clear the editor highlight. */
  onHoverEnd?: () => void;
}

// Memoized so that one node's lazily-fetched enrichment resolving (or a canvas re-render for pan/
// zoom/selection) doesn't force every other node card in the graph to re-render too.
export const QueryFlowNode = memo(function QueryFlowNode({
  node,
  height,
  enrichment,
  onRequest,
  onHoverStart,
  onHoverEnd,
}: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const meta = KIND_META[node.kind] ?? KIND_META[QueryFlowNodeKind.Unknown];
  const accent = getNodeAccentColor(theme, node.kind);
  const params = node.params ?? [];
  const truncated = params.length > NODE_MAX_PARAM_ROWS;
  const shown = truncated ? params.slice(0, NODE_MAX_PARAM_ROWS - 1) : params;
  const docsHref = docsLinkFor(node);

  return (
    <div
      className={styles.card}
      style={{ height, borderLeftColor: accent }}
      onMouseEnter={() => {
        onRequest?.();
        onHoverStart?.();
      }}
      onMouseLeave={onHoverEnd}
      data-testid="query-flow-node-card"
    >
      <div className={styles.header}>
        <Icon name={meta.icon} size="lg" className={styles.icon} style={{ color: accent }} />
        <span className={styles.label} title={node.label}>
          {node.label}
        </span>
        {docsHref && <DocsLink href={docsHref} nodeKind={node.kind} />}
        <NodeStatus enrichment={enrichment} onRetry={onRequest} />
      </div>

      {node.sublabel && (
        <div className={styles.sublabel} title={node.sublabel}>
          {node.sublabel}
        </div>
      )}

      {params.length > 0 && (
        <div className={styles.params}>
          {shown.map((param, index) => (
            <ParamRow key={index} value={param.value} accent={accent} />
          ))}
          {truncated && (
            <div className={styles.more}>
              {t('explore.query-flow.more-attributes', '', {
                count: params.length - shown.length,
                defaultValue_one: '+{{count}} more',
                defaultValue_other: '+{{count}} more',
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function ParamRow({ value, accent }: { value: string; accent: string }) {
  const styles = useStyles2(getStyles);
  const match = MATCHER_RE.exec(value);
  return (
    <div className={styles.param} title={value}>
      {match ? (
        <>
          <span className={styles.paramKey} style={{ color: accent }}>
            {match[1]}
          </span>
          <span className={styles.paramOp}>{match[2]}</span>
          <span className={styles.paramValue}>{match[3]}</span>
        </>
      ) : (
        <span className={styles.paramValue}>{value}</span>
      )}
    </div>
  );
}

function DocsLink({ href, nodeKind }: { href: string; nodeKind: QueryFlowNodeKind }) {
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
        data-testid="query-flow-node-docs"
        // Don't let a click/drag on the link start a canvas node-drag.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          reportInteraction('grafana_explore_query_flow_docs_click', { source: 'node', nodeKind });
        }}
      >
        <Icon name="book" size="sm" />
      </a>
    </Tooltip>
  );
}

function NodeStatus({ enrichment, onRetry }: { enrichment?: NodeEnrichment; onRetry?: () => void }) {
  const styles = useStyles2(getStyles);
  if (enrichment?.state === 'loading') {
    return <Spinner size="sm" inline />;
  }
  if (enrichment?.state === 'error') {
    const label = t('explore.query-flow.enrichment-error', "Couldn't load details \u2014 click to retry");
    return (
      <IconButton
        name="exclamation-triangle"
        size="sm"
        variant="destructive"
        tooltip={label}
        aria-label={label}
        data-testid="query-flow-node-error"
        // Don't let a click/drag on the button start a canvas node-drag.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRetry?.();
        }}
      />
    );
  }
  if (!hasTooltip(enrichment)) {
    return null;
  }
  return (
    <Tooltip content={<EnrichmentTooltip enrichment={enrichment} />} placement="top" interactive>
      <Icon
        name="info-circle"
        className={styles.info}
        data-testid="query-flow-node-info"
        tabIndex={0}
        aria-label={t('explore.query-flow.node-details', 'Node details')}
      />
    </Tooltip>
  );
}

function hasTooltip(enrichment?: NodeEnrichment): enrichment is NodeEnrichment {
  return !!enrichment && (!!enrichment.badge || !!enrichment.note || !!enrichment.rows?.length);
}

function EnrichmentTooltip({ enrichment }: { enrichment: NodeEnrichment }) {
  const styles = useStyles2(getTooltipStyles);
  return (
    <div className={styles.tooltip}>
      {enrichment.badge && <div className={styles.badge}>{enrichment.badge}</div>}
      {enrichment.note && <div className={styles.note}>{enrichment.note}</div>}
      {enrichment.rows?.map((row, index) => (
        <div key={index} className={styles.row}>
          <span className={styles.rowLabel}>{row.label}</span>
          <span className={styles.rowValue}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: NODE_WIDTH,
    boxSizing: 'border-box',
    padding: theme.spacing(1, 1.5),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderLeft: `3px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z1,
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    height: 24,
    flexShrink: 0,
  }),
  icon: css({
    flexShrink: 0,
  }),
  label: css({
    flex: 1,
    minWidth: 0,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  info: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
    cursor: 'help',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  docs: css({
    display: 'inline-flex',
    flexShrink: 0,
    color: theme.colors.text.secondary,
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  sublabel: css({
    height: 18,
    lineHeight: '18px',
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }),
  params: css({
    display: 'flex',
    flexDirection: 'column',
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    minHeight: 0,
  }),
  param: css({
    display: 'flex',
    alignItems: 'center',
    height: 22,
    lineHeight: '22px',
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  paramKey: css({
    fontWeight: theme.typography.fontWeightMedium,
  }),
  paramOp: css({
    color: theme.colors.text.secondary,
    padding: theme.spacing(0, 0.25),
  }),
  paramValue: css({
    color: theme.colors.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  more: css({
    height: 22,
    lineHeight: '22px',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
});

const getTooltipStyles = (theme: GrafanaTheme2) => ({
  tooltip: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    maxWidth: 320,
  }),
  badge: css({
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  note: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(0.5),
  }),
  row: css({
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  }),
  rowLabel: css({
    color: theme.colors.text.secondary,
  }),
  rowValue: css({
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
});
