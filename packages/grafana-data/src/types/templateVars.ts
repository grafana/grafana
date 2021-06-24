export type VariableType =
  | 'query'
  | 'adhoc'
  | 'constant'
  | 'datasource'
  | 'interval'
  | 'datetime'
  | 'textbox'
  | 'custom'
  | 'system';

export interface VariableModel {
  type: VariableType;
  name: string;
  label: string | null;
}
