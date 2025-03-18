import { DataQuery } from '@grafana/data';

export function selectQuery(target: DataQuery): void {
  alert(`You selected query "${target.refId}"`);
}
