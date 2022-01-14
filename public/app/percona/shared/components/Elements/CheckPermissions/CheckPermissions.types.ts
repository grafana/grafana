import { Settings } from 'app/percona/settings/Settings.types';

export interface CheckPermissionsProps {
  onSettingsLoadSuccess?: (settings: Settings) => void;
  onSettingsLoadError?: () => void;
}
