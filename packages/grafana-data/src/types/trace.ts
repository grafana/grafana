type TraceKeyValuePair = {
  key: string;
  value: any;
};

type TraceLog = {
  // Millisecond epoch time
  timestamp: number;
  fields: TraceKeyValuePair[];
};

/**
 * This describes the structure of the dataframe that should be returned from a tracing data source to show trace
 * in a TraceView component.
 */
export interface TraceSpanRow {
  traceID: string;
  spanID: string;
  parentSpanID?: string;
  operationName: string;
  serviceName: string;
  serviceTags: TraceKeyValuePair[];
  // Millisecond epoch time
  startTime: number;
  // Milliseconds
  duration: number;
  logs?: TraceLog[];

  // Note: To mark spen as having error add tag error: true
  tags?: TraceKeyValuePair[];
  warnings?: string[];
  stackTraces?: string[];

  // Specify custom color of the error icon
  errorIconColor?: string;
}
