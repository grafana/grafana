import { SelectableValue } from '@grafana/data';
import { isEqual } from 'lodash';
import { MetricsResolutions } from 'app/percona/settings/Settings.types';
import { defaultResolutions, resolutionsOptions } from './MetricsResolution.constants';

export const getResolutionValue = (metricsResolutions: MetricsResolutions): SelectableValue => {
  const index = defaultResolutions.findIndex((resolution) => isEqual(resolution, metricsResolutions));

  return index !== -1 ? resolutionsOptions[index] : resolutionsOptions[resolutionsOptions.length - 1];
};

const replaceS = (r: string) => r.replace('s', '');

// eslint-disable-next-line max-len
export const removeUnits = (r: MetricsResolutions) => ({ lr: replaceS(r.lr), mr: replaceS(r.mr), hr: replaceS(r.hr) });
export const addUnits = (r: MetricsResolutions) => ({ lr: `${r.lr}s`, mr: `${r.mr}s`, hr: `${r.hr}s` });
