import { ChangeEvent, MouseEvent } from 'react';
import { FixedSizeList } from 'react-window';

import { selectors } from '@grafana/e2e-selectors';
import { BrowserLabel as PromLabel, Input, Label } from '@grafana/ui';

import { LIST_ITEM_SIZE, SelectableLabel } from './types';

interface MetricSelectorProps {
  metrics: SelectableLabel | undefined;
  metricSearchTerm: string;
  seriesLimit: string;
  onChangeMetricSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  onChangeSeriesLimit: (event: ChangeEvent<HTMLInputElement>) => void;
  onClickMetric: (name: string, value: string | undefined, event: MouseEvent<HTMLElement>) => void;
  styles: Record<string, string>;
}

export function MetricSelector({
  metrics,
  metricSearchTerm,
  seriesLimit,
  onChangeMetricSearch,
  onChangeSeriesLimit,
  onClickMetric,
  styles,
}: MetricSelectorProps) {
  const metricCount = metrics?.values?.length || 0;

  return (
    <div>
      <div className={styles.section}>
        <Label description="Once a metric is selected only possible labels are shown. Labels are limited by the series limit below.">
          1. Select a metric
        </Label>
        <div>
          <Input
            onChange={onChangeMetricSearch}
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
                    onClick={onClickMetric}
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
