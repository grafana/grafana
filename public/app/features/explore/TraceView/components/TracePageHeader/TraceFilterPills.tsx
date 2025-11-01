import { useMemo } from 'react';

import { TraceSearchProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FilterPill, Stack } from '@grafana/ui';

import { Trace } from '../types/trace';

export interface TraceFilterPillsProps {
  trace: Trace;
  search: TraceSearchProps;
  setSearch: (search: TraceSearchProps) => void;
}

export function TraceFilterPills({ trace, search, setSearch }: TraceFilterPillsProps) {
  // Calculate max duration for high latency filter
  const maxDuration = useMemo(() => {
    return Math.max(...trace.spans.map((span) => span.duration));
  }, [trace.spans]);

  const highLatencyThreshold = Math.round(maxDuration * 0.7);

  return (
    <Stack gap={1} direction="row">
      <FilterPill
        selected={search.criticalPathOnly}
        label={t('explore.trace-page-header.critical-path', 'Critical path')}
        onClick={() => setSearch({ ...search, criticalPathOnly: !search.criticalPathOnly })}
      />
      <FilterPill
        selected={!!search.adhocFilters?.some((f) => f.key === 'status' && f.operator === '=' && f.value === 'error')}
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
      <FilterPill
        selected={
          !!search.adhocFilters?.some(
            (f) => f.key === 'duration' && f.operator === '>=' && parseFloat(f.value || '0') === highLatencyThreshold
          )
        }
        label={t('explore.trace-page-header.high-latency', 'High latency')}
        onClick={() => {
          const hasHighLatencyFilter = search.adhocFilters?.some(
            (f) => f.key === 'duration' && f.operator === '>=' && parseFloat(f.value || '0') === highLatencyThreshold
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
    </Stack>
  );
}
