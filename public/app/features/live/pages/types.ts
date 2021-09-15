export interface Converter {
  type: string;
  [t: string]: any;
}

export interface Processor {
  type: string;
  [t: string]: any;
}

export interface Output {
  type: string;
  [t: string]: any;
  multiple?: {
    outputs: Output[];
  };
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
