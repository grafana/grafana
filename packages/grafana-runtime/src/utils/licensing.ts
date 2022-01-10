import { FeatureToggles } from '@grafana/data';
import { config } from '../config';

export const featureEnabled = (feature: boolean | undefined | keyof FeatureToggles): boolean => {
  if (feature === true || feature === false) {
    return feature;
  }
  if (feature == null || !config?.featureToggles) {
    return false;
  }
  return Boolean(config.featureToggles[feature]);
};
