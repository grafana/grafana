import { type DataFrame } from '@grafana/data';

export type PruneStatus = 'PRUNED_ON_READ' | 'PRUNED_ON_WRITE';

/** From the Tempo data source (`meta.custom.pruneStatus`). Undefined means unknown, not "not pruned". */
export function getPruneStatus(frame: DataFrame | undefined): PruneStatus | undefined {
  const status = frame?.meta?.custom?.pruneStatus;
  return status === 'PRUNED_ON_READ' || status === 'PRUNED_ON_WRITE' ? status : undefined;
}
