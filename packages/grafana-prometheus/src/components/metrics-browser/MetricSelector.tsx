import { ChangeEvent, useState } from 'react';
import { FixedSizeList } from 'react-window';

import { selectors } from '@grafana/e2e-selectors';
import { BrowserLabel as PromLabel, Input, Label } from '@grafana/ui';

import { LIST_ITEM_SIZE, METRIC_LABEL, SelectableLabel } from './types';

interface MetricSelectorProps {
  labels: SelectableLabel[];
  seriesLimit: string;
  onChangeSeriesLimit: (event: ChangeEvent<HTMLInputElement>) => void;
  onClickMetric: (name: string, value: string | undefined) => void;
  styles: Record<string, string>;
}

export function MetricSelector({ labels, seriesLimit, onChangeSeriesLimit, onClickMetric, styles }: MetricSelectorProps) {
  const [metricSearchTerm, setMetricSearchTerm] = useState('');

  // Filter metrics
  let metrics = labels.find((label) => label.name === METRIC_LABEL);
  if (metrics && metricSearchTerm) {
    metrics = {
      ...metrics,
      values: metrics.values?.filter((value) => value.selected || value.name.includes(metricSearchTerm)),
    };
  }

  const metricCount = metrics?.values?.length || 0;

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
            onChange={onChangeSeriesLimit}
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
            height={Math.min(450, metricCount * LIST_ITEM_SIZE)}
            itemCount={metricCount}
            itemSize={LIST_ITEM_SIZE}
            itemKey={(i) => metrics!.values![i].name}
            width={300}
            className={styles.valueList}
          >
            {({ index, style }) => {
              const value = metrics?.values?.[index];
              if (!value) {
                return null;
              }
              return (
                <div style={style}>
                  <PromLabel
                    name={metrics!.name}
                    value={value?.name}
                    title={value.details}
                    active={value?.selected}
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
