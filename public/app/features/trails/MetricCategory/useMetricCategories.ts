import { useMemo } from 'react';

export function useMetricCategories(metrics: string[]) {
  return useMemo(() => processMetrics(metrics), [metrics]);
}

interface MetricPartNode {
  isMetric?: boolean;
  children: Record<string, MetricPartNode>;
}

function processMetrics(metrics: string[]) {
  const categoryTree: MetricPartNode = { children: {} };

  function insertMetric(metric: string) {
    if (metric.indexOf(':') !== -1) {
      // Ignore recording rules.
      return;
    }

    const metricParts = metric.split('_');

    let cursor = categoryTree;
    for (const metricPart of metricParts) {
      let node = cursor.children[metricPart];
      if (!node) {
        // Create new node
        node = {
          children: {},
        };
        // Insert it
        cursor.children[metricPart] = node;
      }
      cursor = node;
    }
    // We know this node is a metric because it was for the last metricPart
    cursor.isMetric = true;
  }

  metrics.forEach((metric) => insertMetric(metric));

  return categoryTree;
}
