import { useMemo, useState } from 'react';
import { FixedSizeList } from 'react-window';

import { selectors } from '@grafana/e2e-selectors';
import { BrowserLabel as PromLabel, Input, Label } from '@grafana/ui';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { LIST_ITEM_SIZE } from './types';

interface MetricSelectorProps {
  styles: Record<string, string>;
}

export function MetricSelector({ styles }: MetricSelectorProps) {
  const [metricSearchTerm, setMetricSearchTerm] = useState('');
  const { metrics, selectedMetric, seriesLimit, setSeriesLimit, onMetricClick } = useMetricsBrowser();

  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => m.name === selectedMetric || m.name.includes(metricSearchTerm));
  }, [metrics, selectedMetric, metricSearchTerm]);

  return (
    <div>
      <div className={styles.section}>
        <Label description="Once a metric is selected only possible labels are shown. Labels are limited by the series limit below.">
          1. Select a metric
        </Label>
        <div>
          <Input
            onChange={(e) => setMetricSearchTerm(e.currentTarget.value)}
            aria-label="Filter expression for metric"
            value={metricSearchTerm}
            data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.selectMetric}
          />
        </div>
        <Label description="Set to 'none' to remove limit and show all labels for a selected metric. Removing the limit may cause performance issues.">
          Series limit
        </Label>
        <div>
          <Input
            onChange={(e) => setSeriesLimit(e.currentTarget.value.trim())}
            aria-label="Limit results from series endpoint"
            value={seriesLimit}
            data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.seriesLimit}
          />
        </div>
        <div
          role="list"
          className={styles.valueListWrapper}
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.metricList}
        >
          <FixedSizeList
            height={Math.min(450, filteredMetrics.length * LIST_ITEM_SIZE)}
            itemCount={filteredMetrics.length}
            itemSize={LIST_ITEM_SIZE}
            itemKey={(i) => filteredMetrics[i].name}
            width={300}
            className={styles.valueList}
          >
            {({ index, style }) => {
              const metric = filteredMetrics[index];
              return (
                <div style={style}>
                  <PromLabel
                    name={metric.name}
                    value={metric.name}
                    title={metric.details}
                    active={metric.name === selectedMetric}
                    onClick={(name: string, value: string | undefined) => {
                      // Resetting search to prevent empty results
                      setMetricSearchTerm('');
                      onMetricClick(name);
                    }}
                    searchTerm={metricSearchTerm}
                  />
                </div>
              );
            }}
          </FixedSizeList>
        </div>
      </div>
    </div>
  );
}
