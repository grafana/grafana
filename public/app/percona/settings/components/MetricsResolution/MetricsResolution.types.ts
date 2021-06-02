import { MetricsResolutions } from 'app/percona/settings/Settings.types';
import { LoadingCallback } from 'app/percona/settings/Settings.service';

export interface MetricsResolutionProps {
  metricsResolutions: MetricsResolutions;
  updateSettings: (body: any, callback: LoadingCallback) => void;
}

export enum MetricsResolutionIntervals {
  lr = 'lr',
  mr = 'mr',
  hr = 'hr',
}

export enum MetricsResolutionPresets {
  rare = 'rare',
  standard = 'standard',
  frequent = 'frequent',
  custom = 'custom',
}
