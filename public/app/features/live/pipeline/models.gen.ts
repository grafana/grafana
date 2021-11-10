/* Do not change, this code is generated from Golang structs */

export interface JsonFrameConverterConfig {}
export interface AutoInfluxConverterConfig {
  frameFormat: string;
}
export interface ExactJsonConverterConfig {
  fields: Field[];
}
export interface DataLink {
  title?: string;
  targetBlank?: boolean;
  url?: string;
}
export interface Threshold {
  value?: number;
  color?: string;
  state?: string;
}
export interface ThresholdsConfig {
  mode: string;
  steps: Threshold[];
}
export interface FieldConfig {
  displayName?: string;
  displayNameFromDS?: string;
  path?: string;
  description?: string;
  filterable?: boolean;
  writeable?: boolean;
  unit?: string;
  decimals?: number;
  min?: number;
  max?: number;
  mappings?: any[];
  thresholds?: ThresholdsConfig;
  color?: { [key: string]: any };
  links?: DataLink[];
  noValue?: string;
  custom?: { [key: string]: any };
}
export interface Label {
  name: string;
  value: string;
}
export interface Field {
  name: string;
  type: number;
  value: string;
  labels?: Label[];
  config?: FieldConfig;
}
export interface AutoJsonConverterConfig {
  fieldTips?: { [key: string]: Field };
}
export interface ConverterConfig {
  type: string;
  jsonAuto?: AutoJsonConverterConfig;
  jsonExact?: ExactJsonConverterConfig;
  influxAuto?: AutoInfluxConverterConfig;
  jsonFrame?: JsonFrameConverterConfig;
}
export interface MultipleFrameProcessorConfig {
  processors: FrameProcessorConfig[];
}
export interface KeepFieldsFrameProcessorConfig {
  fieldNames: string[];
}
export interface DropFieldsFrameProcessorConfig {
  fieldNames: string[];
}
export interface FrameProcessorConfig {
  type: string;
  dropFields?: DropFieldsFrameProcessorConfig;
  keepFields?: KeepFieldsFrameProcessorConfig;
  multiple?: MultipleFrameProcessorConfig;
}

export interface ChangeLogOutputConfig {
  fieldName: string;
  channel: string;
}
export interface LokiOutputConfig {
  uid: string;
}
export interface RemoteWriteOutputConfig {
  uid: string;
  sampleMilliseconds: number;
}
export interface ThresholdOutputConfig {
  fieldName: string;
  channel: string;
}
export interface NumberCompareFrameConditionConfig {
  fieldName: string;
  op: string;
  value: number;
}
export interface MultipleFrameConditionCheckerConfig {
  type: string;
  conditions: FrameConditionCheckerConfig[];
}
export interface FrameConditionCheckerConfig {
  type: string;
  multiple?: MultipleFrameConditionCheckerConfig;
  numberCompare?: NumberCompareFrameConditionConfig;
}
export interface ConditionalOutputConfig {
  condition?: FrameConditionCheckerConfig;
  output?: FrameOutputterConfig;
}
export interface RedirectOutputConfig {
  channel: string;
}
export interface ManagedStreamOutputConfig {}
export interface FrameOutputterConfig {
  type: string;
  managedStream?: ManagedStreamOutputConfig;
  multiple?: MultipleOutputterConfig;
  redirect?: RedirectOutputConfig;
  conditional?: ConditionalOutputConfig;
  threshold?: ThresholdOutputConfig;
  remoteWrite?: RemoteWriteOutputConfig;
  loki?: LokiOutputConfig;
  changeLog?: ChangeLogOutputConfig;
}
export interface MultipleOutputterConfig {
  outputs: FrameOutputterConfig[];
}

export interface SubscriberConfig {
  type: string;
  multiple?: MultipleSubscriberConfig;
}
export interface MultipleSubscriberConfig {
  subscribers: SubscriberConfig[];
}

export interface RedirectDataOutputConfig {
  channel: string;
}
export interface DataOutputterConfig {
  type: string;
  redirect?: RedirectDataOutputConfig;
  loki?: LokiOutputConfig;
}
