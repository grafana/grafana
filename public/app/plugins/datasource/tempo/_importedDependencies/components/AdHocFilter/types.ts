// import { AdHocVariableFilter } from '../../../features/variables/types';
export interface AdHocVariableFilter {
  key: string;
  operator: string;
  value: string;
  /** @deprecated  */
  condition?: string;
}
