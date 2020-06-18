export type VariableType =
  | 'query'
  | 'adhoc'
  | 'constant'
  | 'datasource'
  | 'interval'
  | 'textbox'
  | 'custom'
  | 'dynamic';

export interface VariableModel {
  type: VariableType;
  name: string;
  label: string | null;
}
