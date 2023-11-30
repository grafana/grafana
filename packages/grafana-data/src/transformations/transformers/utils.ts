import { getFeatureToggles } from '../../config';

export const transformationsVariableSupport = () => {
  return getFeatureToggles().transformationsVariableSupport;
};
