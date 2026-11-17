import { type VarMappingKind } from '@grafana/data/internal';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

/**
 * Reports an option switching between a fixed value and a variable. Editing an expression, such as
 * picking another variable, isn't reported, so the events count how many options start and stop
 * using variables.
 */
export function reportVarMappingChange(
  properties: { option: string; kind: VarMappingKind; source: 'defaults' | 'override' },
  previous: unknown,
  next: unknown
) {
  if (previous === undefined && next !== undefined) {
    DashboardInteractions.panelOptionVariableSet(properties);
  } else if (previous !== undefined && next === undefined) {
    DashboardInteractions.panelOptionVariableRemoved(properties);
  }
}
