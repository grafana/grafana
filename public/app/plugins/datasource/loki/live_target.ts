import { AppendingVector, DataFrame, Labels } from '@grafana/data';
import { Subscription } from 'rxjs';

export interface BufferedData {
  // Direct Access
  times: AppendingVector<string>;
  lines: AppendingVector<string>;
  labels: AppendingVector<Labels>;

  // Structured
  frame: DataFrame;
}

export interface LiveTarget {
  query: string;
  regexp: string;
  url: string; // use as unique key?
  refId: string;
  queryLabels: Labels;

  data: BufferedData;

  // WebSocket
  subscription?: Subscription;
}
