import { Settings } from 'app/types';

export interface AuthConfigState {
  settings: Settings;
  updateError?: SettingsError;
  warning?: SettingsError;
}

export interface SettingsError {
  message: string;
  errors: string[];
}
