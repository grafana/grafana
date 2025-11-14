import { useMemo } from 'react';

import { TraceSearchProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FilterPill, Stack, Tooltip } from '@grafana/ui';

import { Trace } from '../types/trace';

export interface TraceFilterPillsProps {
  trace: Trace;
  search: TraceSearchProps;
  setSearch: (search: TraceSearchProps) => void;
}

export function TraceFilterPills({ trace, search, setSearch }: TraceFilterPillsProps) {
  // Calculate max duration for high latency filter
  const sortedDurations = useMemo(() => {
    return trace.spans.map((span) => span.duration).sort((a, b) => a - b);
  }, [trace.spans]);

  const highLatencyThreshold = Math.floor(sortedDurations[Math.floor(sortedDurations.length * 0.9)]);

  return (
    <Stack gap={1} direction="row">
      <Tooltip
        content={t(
          'explore.trace-page-header.critical-path-tooltip',
          'Selects spans in the critical path—the longest sequence of dependent tasks determining the trace minimum duration.'
        )}
      >
        <div>
          <FilterPill
            selected={search.criticalPathOnly}
            label={t('explore.trace-page-header.critical-path', 'Critical path')}
            onClick={() => setSearch({ ...search, criticalPathOnly: !search.criticalPathOnly })}
          />
        </div>
      </Tooltip>
      <Tooltip content={t('explore.trace-page-header.errors-tooltip', 'Selects spans where status equals error.')}>
        <div>
          <FilterPill
            selected={
              !!search.adhocFilters?.some((f) => f.key === 'status' && f.operator === '=' && f.value === 'error')
            }
            label={t('explore.trace-page-header.errors', 'Errors')}
            onClick={() => {
              const hasErrorFilter = search.adhocFilters?.some(
                (f) => f.key === 'status' && f.operator === '=' && f.value === 'error'
              );
              if (hasErrorFilter) {
                // Remove error filter
                setSearch({
                  ...search,
                  adhocFilters: search.adhocFilters?.filter(
                    (f) => !(f.key === 'status' && f.operator === '=' && f.value === 'error')
                  ),
                });
              } else {
                // Add error filter
                setSearch({
                  ...search,
                  adhocFilters: [...(search.adhocFilters || []), { key: 'status', operator: '=', value: 'error' }],
                });
              }
            }}
          />
        </div>
      </Tooltip>
      <Tooltip
        content={t(
          'explore.trace-page-header.high-latency-tooltip',
          'Selects the 10% longest spans in the trace (p90).'
        )}
      >
        <div>
          <FilterPill
            selected={
              !!search.adhocFilters?.some(
                (f) =>
                  f.key === 'duration' && f.operator === '>=' && parseFloat(f.value || '0') === highLatencyThreshold
              )
            }
            label={t('explore.trace-page-header.high-latency', 'High latency')}
            onClick={() => {
              const hasHighLatencyFilter = search.adhocFilters?.some(
                (f) =>
                  f.key === 'duration' && f.operator === '>=' && parseFloat(f.value || '0') === highLatencyThreshold
              );
              if (hasHighLatencyFilter) {
                // Remove high latency filter
                setSearch({
                  ...search,
                  adhocFilters: search.adhocFilters?.filter((f) => f.key !== 'duration'),
                });
              } else {
                // Add high latency filter (duration >= 70% of max)
                setSearch({
                  ...search,
                  adhocFilters: [
                    ...(search.adhocFilters || []),
                    { key: 'duration', operator: '>=', value: highLatencyThreshold.toString() },
                  ],
                });
              }
            }}
          />
        </div>
      </Tooltip>
    </Stack>
  );
}
