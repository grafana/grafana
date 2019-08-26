import { parseQuery } from './query_utils';
import { CircularVector, DataFrame, FieldType } from '@grafana/data';
import { LokiQuery } from './types';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { convertToWebSocketUrl } from 'app/core/utils/explore';
import { serializeParams } from './datasource';
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

export function prepareLiveDataFrame(target: Partial<LiveTarget>, bufferLength: number): LiveTarget {
  const times = new CircularVector<string>();
  const lines = new CircularVector<string>();
  const frame = {
    refId: target.refId,
    fields: [
      { name: 'ts', type: FieldType.time, config: {}, values: times }, // Time
      { name: 'line', type: FieldType.string, config: {}, values: lines }, // Line
    ],
    length: 0,
  };

  return {
    ...target,

    // The data
    times,
    lines,
    frame,
  } as LiveTarget;
}
