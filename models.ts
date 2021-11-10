/* Do not change, this code is generated from Golang structs */

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

export interface ExactJsonConverterConfig {
  fields: Field[];
}
export interface AutoInfluxConverterConfig {
  frameFormat: string;
}
export interface JsonFrameConverterConfig {}
