import { Labels } from '../../../../types/unified-alerting-dto';

export function labelsToTags(labels: Labels) {
  return Object.entries(labels)
    .map(([label, value]) => `${label}=${value}`)
    .sort();
}
