import { config } from '../config';

export const featureEnabled = (feature: string): boolean => {
  const { enabledFeatures } = config.licenseInfo;
  return enabledFeatures && enabledFeatures[feature];
};
