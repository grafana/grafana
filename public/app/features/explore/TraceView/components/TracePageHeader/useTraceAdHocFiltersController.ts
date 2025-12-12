import { useMemo, useState } from 'react';

import { TraceSearchProps } from '@grafana/data';
import { AdHocFiltersController, AdHocFilterWithLabels } from '@grafana/scenes';

import { Trace } from '../types/trace';

import { TraceAdHocFiltersController } from './TraceAdHocFiltersController';

/**
 * Hook to create and manage a TraceAdHocFiltersController instance.
 * The controller provides keys and values from trace spans and syncs with URL state.
 *
 * @param trace - The trace to extract keys and values from
 * @param search - Current search state including adhoc filters
 * @param setSearch - Function to update search state
 * @returns Controller instance for use with AdHocFiltersComboboxRenderer
 */
export function useTraceAdHocFiltersController(
  trace: Trace | null,
  search: TraceSearchProps,
  setSearch: (search: TraceSearchProps) => void
): AdHocFiltersController | null {
  const [wip, setWip] = useState<AdHocFilterWithLabels | undefined>({
    key: '',
    operator: '=',
    value: '',
  });
  const controller = useMemo(() => {
    if (!trace) {
      return null;
    }
    return new TraceAdHocFiltersController(trace, search, setSearch, wip, setWip);
  }, [trace, search, setSearch, wip, setWip]);

  return controller;
}
