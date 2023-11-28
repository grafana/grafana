import { isEqual } from 'lodash';
import { defaultResolutions, resolutionsOptions } from './MetricsResolution.constants';
export const getResolutionValue = (metricsResolutions) => {
    const index = defaultResolutions.findIndex((resolution) => isEqual(resolution, metricsResolutions));
    return index !== -1 ? resolutionsOptions[index] : resolutionsOptions[resolutionsOptions.length - 1];
};
const replaceS = (r) => r.replace('s', '');
// eslint-disable-next-line max-len
export const removeUnits = (r) => ({ lr: replaceS(r.lr), mr: replaceS(r.mr), hr: replaceS(r.hr) });
export const addUnits = (r) => ({ lr: `${r.lr}s`, mr: `${r.mr}s`, hr: `${r.hr}s` });
//# sourceMappingURL=MetricsResolution.utils.js.map