import { AxiosError } from 'axios';

import { Settings } from 'app/percona/settings/Settings.types';

export interface FeatureLoaderProps {
  featureName: string;
  featureFlag: keyof Settings;
  messagedataTestId?: string;
  onError?: (error: AxiosError) => void;
  onSettingsLoaded?: (settings: Settings) => void;
}
