// Copyright (c) 2025 Grafana Labs
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

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
