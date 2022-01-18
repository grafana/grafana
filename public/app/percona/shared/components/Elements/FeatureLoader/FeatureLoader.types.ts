import { Settings } from 'app/percona/settings/Settings.types';
import { AxiosError } from 'axios';

export interface FeatureLoaderProps {
  featureName: string;
  featureFlag: keyof Settings;
  messagedataTestId?: string;
  onError?: (error: AxiosError) => void;
  onSettingsLoaded?: (settings: Settings) => void;
}
