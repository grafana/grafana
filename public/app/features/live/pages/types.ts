import { DataFrame, SelectableValue } from '@grafana/data';
export interface Converter extends RuleSetting {
  [t: string]: any;
}

export interface Processor extends RuleSetting {
  [t: string]: any;
}

export interface Output extends RuleSetting {
  [t: string]: any;
}

export interface RuleSetting<T = any> {
  type: string;
  [key: string]: any;
}
export interface RuleSettings {
  converter?: Converter;
  frameProcessors?: Processor[];
  frameOutputs?: Output[];
}

export interface Rule {
  pattern: string;
  settings: RuleSettings;
}

export interface Pipeline {
  rules: Rule[];
}

export interface GrafanaCloudBackend {
  uid: string;
  settings: any;
}

export type RuleType = 'converter' | 'frameProcessors' | 'frameOutputs';

export interface PipelineListOption {
  type: string;
  description: string;
  example?: object;
}
export interface EntitiesTypes {
  converters: PipelineListOption[];
  frameProcessors: PipelineListOption[];
  frameOutputs: PipelineListOption[];
}

export interface PipeLineEntitiesInfo {
  converter: SelectableValue[];
  frameProcessors: SelectableValue[];
  frameOutputs: SelectableValue[];
  getExample: (rule: RuleType, type: string) => object;
}

export interface ChannelFrame {
  channel: string;
  frame: DataFrame;
}
