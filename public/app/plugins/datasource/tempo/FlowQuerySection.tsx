import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  type DataFrame,
  type DataQueryRequest,
  type GrafanaTheme2,
  type TimeRange,
  FieldType,
  getDefaultTimeRange,
} from '@grafana/data';
import { Badge, InlineField, InlineFieldRow, RadioButtonGroup, Spinner, useStyles2 } from '@grafana/ui';

import { MetricsQueryType } from './dataquery.gen';
import { type TempoDatasource } from './datasource';
import { FLOW_FACETS, type FlowFacetDef, type FlowFacetFilter, type FlowView, composeFacetQuery, composeFilter } from './flowQuery';
import { type TempoQuery } from './types';

interface Props {
  datasource: TempoDatasource;
  query: TempoQuery;
  onChange: (query: TempoQuery) => void;
  onRunQuery: () => void;
  range?: TimeRange;
}

interface FacetValue {
  value: string;
  count: number;
}

const TOP_N = 10;

const VIEW_OPTIONS: Array<{ label: string; value: FlowView }> = [
  { label: 'Table', value: 'table' },
  { label: 'Topology', value: 'topology' },
];

export function FlowQuerySection({ datasource, query, onChange, onRunQuery, range }: Props) {
  const styles = useStyles2(getStyles);
  const filters = useMemo(() => query.flowFilters ?? [], [query.flowFilters]);
  const flowView = query.flowView ?? 'table';

  const setFlowView = useCallback(
    (view: FlowView) => {
      // flowView only affects which panel the datasource renders; query is intentionally not
      // recomposed here because the datasource table/topology branches recompose it from flowFilters.
      onChange({ ...query, flowView: view });
      onRunQuery();
    },
    [onChange, onRunQuery, query]
  );

  const applyFilters = useCallback(
    (next: FlowFacetFilter[]) => {
      onChange({ ...query, flowFilters: next, query: composeFilter(next) });
      onRunQuery();
    },
    [onChange, onRunQuery, query]
  );

  const addValue = useCallback(
    (facet: FlowFacetDef, value: string) => {
      const existing = filters.find((f) => f.key === facet.key);
      let next: FlowFacetFilter[];
      if (!existing) {
        next = [...filters, { key: facet.key, values: [value] }];
      } else if (existing.values.includes(value)) {
        // Value already selected — no-op, avoid a spurious onChange/onRunQuery re-fire.
        return;
      } else {
        next = filters.map((f) => (f.key === facet.key ? { ...f, values: [...f.values, value] } : f));
      }
      applyFilters(next);
    },
    [filters, applyFilters]
  );

  const removeValue = useCallback(
    (key: string, value: string) => {
      const next = filters
        .map((f) => (f.key === key ? { ...f, values: f.values.filter((v) => v !== value) } : f))
        .filter((f) => f.values.length > 0);
      applyFilters(next);
    },
    [filters, applyFilters]
  );

  return (
    <div className={styles.container}>
      <InlineFieldRow>
        <InlineField label="View">
          <RadioButtonGroup<FlowView>
            options={VIEW_OPTIONS}
            value={flowView}
            onChange={setFlowView}
          />
        </InlineField>
      </InlineFieldRow>
      <ChipBar filters={filters} onRemove={removeValue} />
      <InlineFieldRow>
        <InlineField label="Flow filters" grow>
          <div className={styles.facets}>
            {FLOW_FACETS.map((facet) => (
              <FacetPanel
                key={facet.key}
                facet={facet}
                datasource={datasource}
                filters={filters}
                range={range}
                onPick={(value) => addValue(facet, value)}
              />
            ))}
          </div>
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}

function ChipBar({
  filters,
  onRemove,
}: {
  filters: FlowFacetFilter[];
  onRemove: (key: string, value: string) => void;
}) {
  const styles = useStyles2(getStyles);
  if (filters.length === 0) {
    return null;
  }
  return (
    <div className={styles.chipBar}>
      {filters.flatMap((f) => {
        const def = FLOW_FACETS.find((d) => d.key === f.key)!;
        return f.values.map((v) => {
          const label = `${def.label}: ${v}`;
          return (
            <button
              key={`${f.key}-${v}`}
              className={styles.chip}
              aria-label={`Remove filter ${label}`}
              onClick={() => onRemove(f.key, v)}
            >
              {label} ✕
            </button>
          );
        });
      })}
    </div>
  );
}

function FacetPanel({
  facet,
  datasource,
  filters,
  range,
  onPick,
}: {
  facet: FlowFacetDef;
  datasource: TempoDatasource;
  filters: FlowFacetFilter[];
  range?: TimeRange;
  onPick: (value: string) => void;
}) {
  const styles = useStyles2(getStyles);
  const [values, setValues] = useState<FacetValue[]>([]);
  const [loading, setLoading] = useState(false);

  // Use stable numeric primitives rather than the range object so unrelated re-renders
  // that produce a new range reference do not re-fire the side-query unnecessarily.
  const rangeFrom = range?.from?.valueOf();
  const rangeTo = range?.to?.valueOf();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const queryStr = composeFacetQuery(filters, facet);
    const request: DataQueryRequest<TempoQuery> = {
      requestId: `flow-facet-${facet.key}`,
      interval: '',
      intervalMs: 0,
      range: range ?? getDefaultTimeRange(),
      scopedVars: {},
      startTime: 0,
      timezone: 'browser',
      app: 'explore',
      targets: [
        { refId: 'A', queryType: 'traceql', query: queryStr, metricsQueryType: MetricsQueryType.Instant, filters: [] },
      ],
    };

    lastValueFrom(datasource.query(request))
      .then((res) => {
        if (cancelled) {
          return;
        }
        setValues(extractFacetValues(res.data ?? [], facet.attr));
      })
      .catch(() => {
        if (!cancelled) {
          setValues([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, facet, filters, rangeFrom, rangeTo]);

  return (
    <div className={styles.facetPanel}>
      <div className={styles.facetTitle}>
        {facet.label} {loading && <Spinner size="sm" />}
      </div>
      {values.slice(0, TOP_N).map((v) => (
        <button key={v.value} className={styles.facetValue} onClick={() => onPick(v.value)}>
          <span className={styles.facetValueLabel}>{v.value}</span>
          <Badge text={String(v.count)} color="blue" />
        </button>
      ))}
      {!loading && values.length === 0 && <div className={styles.facetEmpty}>No values</div>}
    </div>
  );
}

// Extract grouped instant-metrics results: one series (frame) per facet value,
// the value carried in the number field's last sample, the value name in its label.
export function extractFacetValues(frames: DataFrame[], attr: string): FacetValue[] {
  const out: FacetValue[] = [];
  for (const frame of frames) {
    const numberField = frame.fields.find((f) => f.type === FieldType.number);
    if (!numberField) {
      continue;
    }
    const value = numberField.labels?.[attr];
    if (value === undefined) {
      continue;
    }
    const samples = Array.from<number>(numberField.values);
    const count = Number(samples[samples.length - 1] ?? 0);
    out.push({ value, count });
  }
  return out.sort((a, b) => b.count - a.count);
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1) }),
  chipBar: css({ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(0.5) }),
  chip: css({
    border: 'none',
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    padding: theme.spacing(0.25, 1),
    cursor: 'pointer',
  }),
  facets: css({ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1), width: '100%' }),
  facetPanel: css({
    minWidth: '180px',
    flex: '1 1 180px',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1),
  }),
  facetTitle: css({ fontWeight: theme.typography.fontWeightMedium, marginBottom: theme.spacing(0.5) }),
  facetValue: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: theme.colors.text.primary,
    padding: theme.spacing(0.25, 0),
    cursor: 'pointer',
  }),
  facetValueLabel: css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  facetEmpty: css({ color: theme.colors.text.secondary, fontStyle: 'italic' }),
});
