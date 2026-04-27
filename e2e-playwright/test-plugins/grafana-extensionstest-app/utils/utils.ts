import { DataQuery } from '@grafana/data/types';

export function selectQuery(target: DataQuery): void {
  alert(`You selected query "${target.refId}"`);
}
