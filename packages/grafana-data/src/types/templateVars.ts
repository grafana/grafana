export type VariableType =
  | 'query'
  | 'adhoc'
  | 'constant'
  | 'datasource'
  | 'interval'
  | 'textbox'
  | 'custom'
  | 'system'
  | 'mapping';

export interface VariableModel {
  type: VariableType;
  name: string;
  label: string | null;
}
