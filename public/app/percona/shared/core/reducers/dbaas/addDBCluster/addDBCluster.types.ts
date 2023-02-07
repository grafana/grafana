import { Settings } from '../../../../../settings/Settings.types';

export interface PerconaAddDBClusterState {
  result?: 'ok' | 'error';
  loading?: boolean;
}

export interface AddDBClusterArgs {
  values: Record<string, any>;
  setPMMAddress?: boolean;
  settings?: Settings;
}
