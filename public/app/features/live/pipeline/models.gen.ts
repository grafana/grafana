/* Do not change, this code is generated from Golang structs */

import { FieldConfig } from '@grafana/data';

export interface ChannelAuthCheckConfig {
  role?: string;
}
export interface ChannelAuthConfig {
  subscribe?: ChannelAuthCheckConfig;
  publish?: ChannelAuthCheckConfig;
}
export interface ChangeLogOutputConfig {
  fieldName: string;
  channel: string;
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
  conditionType: string;
  conditions: FrameConditionCheckerConfig[];
}
export interface FrameConditionCheckerConfig {
  type: Omit<keyof FrameConditionCheckerConfig, 'type'>;
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
export interface MultipleOutputterConfig {
  outputs: FrameOutputterConfig[];
}
export interface ManagedStreamOutputConfig {}
export interface FrameOutputterConfig {
  type: Omit<keyof FrameOutputterConfig, 'type'>;
  managedStream?: ManagedStreamOutputConfig;
  multiple?: MultipleOutputterConfig;
  redirect?: RedirectOutputConfig;
  conditional?: ConditionalOutputConfig;
  threshold?: ThresholdOutputConfig;
  remoteWrite?: RemoteWriteOutputConfig;
  loki?: LokiOutputConfig;
  changeLog?: ChangeLogOutputConfig;
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
  type: Omit<keyof FrameProcessorConfig, 'type'>;
  dropFields?: DropFieldsFrameProcessorConfig;
  keepFields?: KeepFieldsFrameProcessorConfig;
  multiple?: MultipleFrameProcessorConfig;
}
export interface JsonFrameConverterConfig {}
export interface AutoInfluxConverterConfig {
  frameFormat: string;
}
export interface ExactJsonConverterConfig {
  fields: Field[];
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
  type: Omit<keyof ConverterConfig, 'type'>;
  jsonAuto?: AutoJsonConverterConfig;
  jsonExact?: ExactJsonConverterConfig;
  influxAuto?: AutoInfluxConverterConfig;
  jsonFrame?: JsonFrameConverterConfig;
}
export interface LokiOutputConfig {
  uid: string;
}
export interface RedirectDataOutputConfig {
  channel: string;
}
export interface DataOutputterConfig {
  type: Omit<keyof DataOutputterConfig, 'type'>;
  redirect?: RedirectDataOutputConfig;
  loki?: LokiOutputConfig;
}
export interface MultipleSubscriberConfig {
  subscribers: SubscriberConfig[];
}
export interface SubscriberConfig {
  type: Omit<keyof SubscriberConfig, 'type'>;
  multiple?: MultipleSubscriberConfig;
}
export interface ChannelRuleSettings {
  auth?: ChannelAuthConfig;
  subscribers?: SubscriberConfig[];
  dataOutputs?: DataOutputterConfig[];
  converter?: ConverterConfig;
  frameProcessors?: FrameProcessorConfig[];
  frameOutputs?: FrameOutputterConfig[];
}
export interface ChannelRule {
  pattern: string;
  settings: ChannelRuleSettings;
}
