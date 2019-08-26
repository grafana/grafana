import { CircularVector, DataFrame } from '@grafana/data';
import { Subscription } from 'rxjs';

export interface LiveTarget {
  query: string;
  regexp: string;
  url: string; // use as unique key?
  refId: string;

  // The Data
  times: CircularVector<string>;
  lines: CircularVector<string>;
  frame: DataFrame;

  // WebSocket
  subscription?: Subscription;
}
