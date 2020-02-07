import { MatcherConfig, FieldConfig } from '../types';

export interface DynamicConfigValue {
  path: string;
  value: any;
}

export interface ConfigOverrideRule {
  matcher: MatcherConfig;
  properties: DynamicConfigValue[];
}

export interface FieldConfigSource {
  // Defatuls applied to all numeric fields
  defaults: FieldConfig;

  // Rules to override individual values
  overrides: ConfigOverrideRule[];
}
