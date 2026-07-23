// Prototype-only. Not internationalized.
// Metric → label → value drill-down. Shared by Option A rail, its collapsed
// overlay, and Option C's popover.
//
// Row behavior:
//   - Metric NAME (click)      → onMetricClick — docks stats + expands nested labels
//   - Metric + / copy (hover)  → onMetricAdd / clipboard
//   - Label NAME (click)       → expand values (no query change)
//   - Label +/exclude/copy     → onLabelAdd(existence) / onLabelExclude(absence) / clipboard
//   - Value + / exclude / copy → onValueAdd / onValueExclude / clipboard
//
// Tooltip on the metric name row surfaces the full metric name + help text.
/* eslint-disable @grafana/i18n/no-untranslated-strings -- prototype-only, not internationalized */

import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Input, Tooltip, useStyles2 } from '@grafana/ui';

import { MOCK_METRICS, type MockMetric } from './prometheusMockCatalog';

interface MetricTreeProps {
  filter: string;
  onFilterChange: (f: string) => void;
  hideSearch?: boolean;
  // Extra className merged onto the search Input (e.g. to give it more height).
  searchClassName?: string;

  // Click on the metric name → select for stats + expand labels; no insertion.
  onMetricClick: (metric: MockMetric) => void;

  // Explicit-action buttons (hover row). The `anchor` is the clicked button's
  // bounding rect — parents use it to position an overlay menu when the
  // insertion is ambiguous.
  onMetricAdd: (metric: MockMetric, anchor: DOMRect) => void;
  onLabelAdd: (metric: MockMetric, label: string, anchor: DOMRect) => void;
  onLabelExclude: (metric: MockMetric, label: string, anchor: DOMRect) => void;
  onValueAdd: (metric: MockMetric, label: string, value: string, anchor: DOMRect) => void;
  onValueExclude: (metric: MockMetric, label: string, value: string, anchor: DOMRect) => void;

  // Metric name → refIds of queries currently referencing it. Metrics with
  // entries are floated to the top of the list and get refId badges.
  queryRefsByMetric?: Record<string, string[]>;

  // Metric whose stats panel is currently open — its row gets a subtle
  // highlight so the user can see the connection between the panel and the tree.
  highlightedMetricName?: string;
}

// currentTarget's rect at click time — becomes the anchor for any menu the
// parent renders in response.
function rectFrom(e: React.MouseEvent<HTMLElement>): DOMRect {
  return e.currentTarget.getBoundingClientRect();
}

function copy(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

export function MetricTree({
  filter,
  onFilterChange,
  hideSearch,
  searchClassName,
  onMetricClick,
  onMetricAdd,
  onLabelAdd,
  onLabelExclude,
  onValueAdd,
  onValueExclude,
  queryRefsByMetric,
  highlightedMetricName,
}: MetricTreeProps) {
  const styles = useStyles2(getStyles);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [expandedLabel, setExpandedLabel] = useState<Record<string, string | null>>({});

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    const base = !filter ? MOCK_METRICS : MOCK_METRICS.filter((m) => m.name.toLowerCase().includes(q));
    if (!queryRefsByMetric) {
      return base;
    }
    // Stable sort: metrics currently referenced by a query float to the top,
    // preserving catalog order within each group.
    return [...base].sort((a, b) => {
      const aRef = (queryRefsByMetric[a.name]?.length ?? 0) > 0;
      const bRef = (queryRefsByMetric[b.name]?.length ?? 0) > 0;
      if (aRef === bRef) {
        return 0;
      }
      return aRef ? -1 : 1;
    });
  }, [filter, queryRefsByMetric]);

  return (
    <div className={styles.wrap}>
      {!hideSearch && (
        <Input
          className={cx(styles.search, searchClassName)}
          placeholder="Search metrics"
          value={filter}
          onChange={(e) => onFilterChange(e.currentTarget.value)}
          prefix={<Icon name="search" />}
          suffix={
            filter ? (
              <IconButton name="times" aria-label="Clear search" tooltip="Clear" onClick={() => onFilterChange('')} />
            ) : null
          }
          data-testid="prom-prototype-metric-search"
        />
      )}
      <div className={styles.list}>
        {filtered.length === 0 && <div className={styles.empty}>No metrics match &ldquo;{filter}&rdquo;</div>}
        {filtered.map((metric) => {
          const isOpen = expandedMetric === metric.name;
          const isHighlighted = highlightedMetricName === metric.name;
          return (
            <div key={metric.name} className={styles.metricRow}>
              <div className={cx(styles.row, styles.metricHeader, isHighlighted && styles.rowHighlighted)}>
                <button
                  className={styles.chevron}
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                  onClick={() => setExpandedMetric(isOpen ? null : metric.name)}
                >
                  <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
                </button>
                <Tooltip
                  content={
                    <div>
                      <div className={styles.tooltipTitle}>{metric.name}</div>
                      {metric.help && <div className={styles.tooltipHelp}>{metric.help}</div>}
                      <div className={styles.tooltipMeta}>{formatNum(metric.activeSeries)} active series</div>
                    </div>
                  }
                  placement="bottom-start"
                >
                  <button
                    className={styles.metricName}
                    onClick={() => {
                      onMetricClick(metric);
                      setExpandedMetric(metric.name);
                    }}
                  >
                    {metric.name}
                  </button>
                </Tooltip>
                <div className={cx(styles.trailing, 'hover-trailing')}>
                  <div className={cx(styles.hoverActions, 'hover-actions')}>
                    <IconButton
                      name="plus"
                      aria-label="Add to query"
                      tooltip="Add to query"
                      onClick={(e) => onMetricAdd(metric, rectFrom(e))}
                    />
                    <IconButton
                      name="copy"
                      aria-label="Copy selector"
                      tooltip="Copy selector"
                      onClick={() => copy(metric.name)}
                    />
                  </div>
                  {queryRefsByMetric?.[metric.name]?.map((refId) => (
                    <span
                      key={refId}
                      className={cx(styles.refBadge, styles.trailingFade, 'hover-hidden')}
                      title={`Used by query ${refId}`}
                    >
                      {refId}
                    </span>
                  ))}
                  <span className={cx(styles.seriesCount, styles.trailingFade, 'hover-hidden')}>
                    {formatNum(metric.activeSeries)}
                  </span>
                </div>
              </div>
              {isOpen && (
                <div className={styles.labelsBlock}>
                  {metric.labels.map((label) => {
                    const key = `${metric.name}::${label.name}`;
                    const openVal = expandedLabel[key] ?? null;
                    const isLabelOpen = openVal === label.name;
                    return (
                      <div key={label.name} className={styles.labelRow}>
                        <div className={cx(styles.row, styles.labelHeaderRow)}>
                          <button
                            className={styles.chevron}
                            aria-label={isLabelOpen ? 'Collapse values' : 'Expand values'}
                            onClick={() =>
                              setExpandedLabel((prev) => ({
                                ...prev,
                                [key]: isLabelOpen ? null : label.name,
                              }))
                            }
                          >
                            <Icon name={isLabelOpen ? 'angle-down' : 'angle-right'} />
                          </button>
                          <button
                            className={styles.labelName}
                            onClick={() =>
                              setExpandedLabel((prev) => ({
                                ...prev,
                                [key]: isLabelOpen ? null : label.name,
                              }))
                            }
                          >
                            {label.name}
                          </button>
                          <div className={cx(styles.trailing, 'hover-trailing')}>
                            <div className={cx(styles.hoverActions, 'hover-actions')}>
                              <IconButton
                                name="plus"
                                aria-label="Add to query"
                                tooltip="Add to query"
                                onClick={(e) => onLabelAdd(metric, label.name, rectFrom(e))}
                              />
                              <IconButton
                                name="minus-circle"
                                aria-label="Exclude from query"
                                tooltip="Exclude from query"
                                onClick={(e) => onLabelExclude(metric, label.name, rectFrom(e))}
                              />
                              <IconButton
                                name="copy"
                                aria-label="Copy selector"
                                tooltip="Copy selector"
                                onClick={() => copy(`${metric.name}{${label.name}=""}`)}
                              />
                            </div>
                            <span className={cx(styles.labelCard, styles.trailingFade, 'hover-hidden')}>
                              {label.cardinality} values
                            </span>
                          </div>
                        </div>
                        {isLabelOpen && (
                          <div className={styles.valuesBlock}>
                            {label.values.map((value) => (
                              <div key={value} className={cx(styles.row, styles.valueRow)}>
                                <span className={styles.valueDot} />
                                <span className={styles.valueText}>{value}</span>
                                <div className={cx(styles.trailing, 'hover-trailing')}>
                                  <div className={cx(styles.hoverActions, 'hover-actions')}>
                                    <IconButton
                                      name="plus"
                                      aria-label="Add to query"
                                      tooltip="Add to query"
                                      onClick={(e) => onValueAdd(metric, label.name, value, rectFrom(e))}
                                    />
                                    <IconButton
                                      name="minus-circle"
                                      aria-label="Exclude from query"
                                      tooltip="Exclude from query"
                                      onClick={(e) => onValueExclude(metric, label.name, value, rectFrom(e))}
                                    />
                                    <IconButton
                                      name="copy"
                                      aria-label="Copy selector"
                                      tooltip="Copy selector"
                                      onClick={() => copy(`${metric.name}{${label.name}="${value}"}`)}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            {label.cardinality > label.values.length && (
                              <div className={styles.moreValues}>
                                + {label.cardinality - label.values.length} more values
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  }
  return String(n);
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    flex: 1,
  }),
  search: css({
    marginBottom: theme.spacing(1),
  }),
  list: css({
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  }),
  empty: css({
    padding: theme.spacing(2),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    textAlign: 'center',
  }),
  metricRow: css({}),
  // Row is a positioning context so the actions overlay can absolutely-position
  // itself to the right edge. At rest the trailing container sizes to its
  // natural content (count / badges) — the metric name only truncates if it
  // would overrun it. On hover the trailing container reserves enough width
  // for the icon buttons, so truncation shifts to accommodate them.
  row: css({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 1),
    minHeight: 28,
    '&:hover': {
      background: theme.colors.action.hover,
    },
    '&:hover .hover-trailing': {
      minWidth: 80,
    },
    '&:hover .hover-actions': {
      opacity: 1,
      transform: 'translateX(0)',
      pointerEvents: 'auto',
    },
    '&:hover .hover-hidden': {
      opacity: 0,
    },
  }),
  metricHeader: css({}),
  // Subtle persistent highlight for the metric whose stats panel is docked.
  // Rendered above the row's base background but the :hover state still wins.
  rowHighlighted: css({
    background: theme.colors.action.selected,
    boxShadow: `inset 2px 0 0 0 ${theme.colors.primary.border}`,
  }),
  chevron: css({
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  }),
  metricName: css({
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.size.sm,
    textAlign: 'left',
    cursor: 'pointer',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  trailing: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(0.5),
    flexShrink: 0,
    minWidth: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['min-width'], {
        duration: theme.transitions.duration.shortest,
      }),
    },
  }),
  hoverActions: css({
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    paddingRight: theme.spacing(1),
    opacity: 0,
    transform: 'translateX(8px)',
    pointerEvents: 'none',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['opacity', 'transform'], {
        duration: theme.transitions.duration.standard,
      }),
    },
  }),
  seriesCount: css({
    fontSize: theme.typography.size.xs,
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  // Applied to any trailing text/badge that should fade out when the row is
  // hovered (revealing the icons in its place).
  trailingFade: css({
    opacity: 1,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['opacity'], {
        duration: theme.transitions.duration.shortest,
      }),
    },
  }),
  refBadge: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    height: 18,
    padding: theme.spacing(0, 0.5),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.primary.transparent,
    color: theme.colors.primary.text,
    border: `1px solid ${theme.colors.primary.border}`,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.fontWeightMedium,
    flexShrink: 0,
  }),
  labelsBlock: css({
    paddingLeft: theme.spacing(2.5),
  }),
  labelRow: css({}),
  labelHeaderRow: css({}),
  labelName: css({
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.size.sm,
    textAlign: 'left',
    cursor: 'pointer',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  labelCard: css({
    fontSize: theme.typography.size.xs,
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),
  valuesBlock: css({
    paddingLeft: theme.spacing(2.5),
    paddingBottom: theme.spacing(0.5),
  }),
  valueRow: css({
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.size.sm,
  }),
  valueDot: css({
    width: 4,
    height: 4,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.text.disabled,
    flexShrink: 0,
  }),
  valueText: css({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  moreValues: css({
    padding: theme.spacing(0.25, 1),
    fontSize: theme.typography.size.xs,
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
  tooltipTitle: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontWeight: theme.typography.fontWeightMedium,
    marginBottom: theme.spacing(0.25),
    wordBreak: 'break-all',
  }),
  tooltipHelp: css({
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  }),
  tooltipMeta: css({
    fontSize: theme.typography.size.xs,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(0.5),
    paddingTop: theme.spacing(0.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
