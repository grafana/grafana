import { PropsWithChildren } from 'react';

import { Settings } from 'app/percona/settings/Settings.types';

export interface CheckPermissionsProps extends PropsWithChildren {
  onSettingsLoadSuccess?: (settings: Settings) => void;
  onSettingsLoadError?: () => void;
}
