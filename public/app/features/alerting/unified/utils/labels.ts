import { Labels } from '../../../../types/unified-alerting-dto';
import { Label } from '../components/rules/state-history/common';

export function labelsToTags(labels: Labels) {
  return Object.entries(labels)
    .map(([label, value]) => `${label}=${value}`)
    .sort();
}

export function objectLabelsToArray(labels: Labels): Label[] {
  return Object.entries(labels).map(([label, value]) => [label, value]);
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
