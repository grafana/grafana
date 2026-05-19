import { type LabelStats } from '../useLabelsBreakdown';

import { filterLabels } from './labelFilter.utils';

const makeLabel = (key: string, ...values: string[]): LabelStats => ({
  key,
  firing: 0,
  pending: 0,
  values: values.map((v) => ({ value: v, firing: 0, pending: 0 })),
});

const labels: LabelStats[] = [
  makeLabel('env', 'production', 'staging'),
  makeLabel('region', 'us-east-1', 'eu-west-1'),
  makeLabel('severity', 'critical', 'warning'),
];

describe('filterLabels', () => {
  it('returns all labels and empty maps when filter is empty', () => {
    const result = filterLabels(labels, '');
    expect(result.filteredLabels).toBe(labels); // same reference — no copy
    expect(result.valueMatchKeys.size).toBe(0);
    expect(result.valueHitMap.size).toBe(0);
  });

  it('returns all labels and empty maps when filter is whitespace only', () => {
    const result = filterLabels(labels, '   ');
    expect(result.filteredLabels).toBe(labels);
    expect(result.valueMatchKeys.size).toBe(0);
  });

  it('matches by key — includes label, valueMatchKeys empty for that key', () => {
    const result = filterLabels(labels, 'env');
    expect(result.filteredLabels.map((l) => l.key)).toContain('env');
    expect(result.valueMatchKeys.has('env')).toBe(false);
    expect(result.valueHitMap.has('env')).toBe(false);
  });

  it('matches by value only — adds key to valueMatchKeys and records hit indices', () => {
    const result = filterLabels(labels, 'critical');
    expect(result.filteredLabels.map((l) => l.key)).toContain('severity');
    expect(result.valueMatchKeys.has('severity')).toBe(true);
    // 'critical' is index 0 in severity values
    expect(result.valueHitMap.get('severity')).toEqual(new Set([0]));
  });

  it('returns empty filteredLabels when nothing matches', () => {
    const result = filterLabels(labels, 'zzznomatch');
    expect(result.filteredLabels).toHaveLength(0);
    expect(result.valueMatchKeys.size).toBe(0);
    expect(result.valueHitMap.size).toBe(0);
  });
});
