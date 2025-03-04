import { useCallback, useMemo, useState } from 'react';
import { FixedSizeList } from 'react-window';

import { selectors } from '@grafana/e2e-selectors';
import { BrowserLabel as PromLabel, Input, Label } from '@grafana/ui';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { LIST_ITEM_SIZE } from './types';

interface MetricSelectorProps {
  onClickMetric: (name: string, value: string | undefined) => void;
  styles: Record<string, string>;
}

export function MetricSelector({ onClickMetric, styles }: MetricSelectorProps) {
  const [metricSearchTerm, setMetricSearchTerm] = useState('');
  const { metrics, selectedMetric, seriesLimit, setSeriesLimit, languageProvider } = useMetricsBrowser();

  const filteredMetrics = useMemo(
    () => metrics.filter((m) => m === selectedMetric || m.includes(metricSearchTerm)),
    [metricSearchTerm, metrics, selectedMetric]
  );

  const getDetails = useCallback(
    (metricName: string) => {
      const meta = languageProvider.metricsMetadata;
      if (meta && meta[metricName]) {
        return `(${meta.type}) ${meta.help}`;
      }
      return undefined;
    },
    [languageProvider.metricsMetadata]
  );

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
            itemKey={(i) => filteredMetrics[i]}
            width={300}
            className={styles.valueList}
          >
            {({ index, style }) => {
              const metric = filteredMetrics[index];
              return (
                <div style={style}>
                  <PromLabel
                    name={metric}
                    value={metric}
                    title={getDetails(metric)}
                    active={selectedMetric === metric}
                    onClick={(name: string, value: string | undefined) => {
                      // Resetting search to prevent empty results
                      setMetricSearchTerm('');
                      onClickMetric(name, value);
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
