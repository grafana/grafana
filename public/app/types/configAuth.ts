import { Settings } from 'app/types';

export interface AuthConfigState {
  settings: Settings;
  updateError?: SettingsUpdateError;
}

export interface SettingsUpdateError {
  message: string;
  errors: string[];
}
