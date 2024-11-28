import { isEmpty } from 'lodash';

import { Labels } from '../../../../types/unified-alerting-dto';
import { Label } from '../components/rules/state-history/common';

export function labelsToTags(labels: Labels) {
  return Object.entries(labels)
    .map(([label, value]) => `${label}=${value}`)
    .sort();
}

export function objectLabelsToArray(labels: Labels): Label[] {
  return Object.entries(labels);
}

export function arrayLabelsToObject(labels: Label[]): Labels {
  const labelsObject: Labels = {};
  labels.forEach((label: Label) => {
    labelsObject[label[0]] = label[1];
  });
  return labelsObject;
}

export function arrayKeyValuesToObject(
  labels: Array<{
    key: string;
    value: string;
  }>
): Labels {
  const labelsObject: Labels = {};
  labels.forEach((label) => {
    label.key && (labelsObject[label.key] = label.value);
  });

  return labelsObject;
}

export const GRAFANA_ORIGIN_LABEL = '__grafana_origin';

export function labelsSize(labels?: Labels) {
  if (isEmpty(labels)) {
    return 0;
  }

  return Object.keys(labels).filter((key) => !isPrivateLabelKey(key)).length;
}

export function isPrivateLabelKey(labelKey: string) {
  return (labelKey.startsWith('__') && labelKey.endsWith('__')) || labelKey === GRAFANA_ORIGIN_LABEL;
}

export const isPrivateLabel = ([key, _]: [string, string]) => isPrivateLabelKey(key);
