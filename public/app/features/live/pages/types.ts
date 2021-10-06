import { SelectableValue } from '@grafana/data';
export interface Converter extends RuleSetting {
  [t: string]: any;
}

export interface Processor extends RuleSetting {
  [t: string]: any;
}

export interface Output extends RuleSetting {
  [t: string]: any;
  multiple?: {
    outputs: Output[];
  };
}

export interface RuleSetting<T = any> {
  type: string;
  [key: string]: any;
}
export interface RuleSettings {
  converter?: Converter;
  processor?: Processor;
  output?: Output;
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

export type RuleType = 'converter' | 'processor' | 'output';

export interface PipelineListOption {
  type: string;
  description: string;
  example: object;
}
export interface EntitiesTypes {
  converters: PipelineListOption[];
  processors: PipelineListOption[];
  outputs: PipelineListOption[];
}

export interface PipeLineEntitiesInfo {
  converter: SelectableValue[];
  processor: SelectableValue[];
  output: SelectableValue[];
  getExample: (rule: RuleType, type: string) => object;
}
