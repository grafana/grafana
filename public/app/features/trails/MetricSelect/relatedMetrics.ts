import leven from 'leven';

export function sortRelatedMetrics(metricList: string[], metric: string) {
  return metricList.sort((aValue, bValue) => {
    const a = getLevenDistances(aValue, metric);
    const b = getLevenDistances(bValue, metric);

    return a.halfLeven + a.wholeLeven - (b.halfLeven + b.wholeLeven);
  });
}

type LevenDistances = { halfLeven: number; wholeLeven: number };
type TargetToLevenDistances = Map<string, LevenDistances>;

const metricToTargetLevenDistances = new Map<string, TargetToLevenDistances>();

// Provides the Levenshtein distance between a metric to be sorted
// and a targetMetric compared to which all other metrics are being sorted
// There are two distances: once for the first half and once for the whole string.
// This operation is not expected to be symmetric; order of parameters matters
// since only `metric` is split.
function getLevenDistances(metric: string, targetMetric: string) {
  let targetToDistances: TargetToLevenDistances | undefined = metricToTargetLevenDistances.get(metric);
  if (!targetToDistances) {
    targetToDistances = new Map<string, LevenDistances>();
    metricToTargetLevenDistances.set(metric, targetToDistances);
  }

  let distances: LevenDistances | undefined = targetToDistances.get(targetMetric);
  if (!distances) {
    const metricSplit = metric.split('_');
    const metricHalf = metricSplit.slice(0, metricSplit.length / 2).join('_');

    const halfLeven = leven(metricHalf, targetMetric!) || 0;
    const wholeLeven = leven(metric, targetMetric!) || 0;

    distances = { halfLeven, wholeLeven };
    targetToDistances.set(targetMetric, distances);
  }

  return distances;
}
