import { AppendingVector } from '@grafana/data';
import { Subscription } from 'rxjs';

export interface LiveTarget {
  query: string;
  regexp: string;
  url: string; // use as unique key?
  refId: string;
  isDelta?: boolean;

  // The Data
  times: AppendingVector<string>;
  lines: AppendingVector<string>;

  // WebSocket
  subscription?: Subscription;
}
