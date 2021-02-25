type TraceKeyValuePair = {
  key: string;
  value: any;
};

type TraceLog = {
  timestamp: number;
  fields: TraceKeyValuePair[];
};

export interface TraceSpanRow {
  traceID: string;
  spanID: string;
  parentSpanID?: string;
  operationName: string;
  serviceName: string;
  serviceTags: TraceKeyValuePair[];
  startTime: number;
  duration: number;
  logs?: TraceLog[];
  tags?: TraceKeyValuePair[];
  warnings?: string[];
  stackTraces?: string[];
  errorIconColor?: string;
}
