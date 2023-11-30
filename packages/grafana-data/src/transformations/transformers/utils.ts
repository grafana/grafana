import { getFeatureToggles } from '../../config';

export const transformationsVariableSupport = () => {
  console.log(getFeatureToggles().transformationsVariableSupport);
  return getFeatureToggles().transformationsVariableSupport;
};
