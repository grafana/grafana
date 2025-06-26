import { useMemo, useState } from 'react';
import { FixedSizeList } from 'react-window';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { BrowserLabel as PromLabel, Input, Label, useStyles2 } from '@grafana/ui';

import { LIST_ITEM_SIZE } from '../../constants';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { getStylesMetricSelector } from './styles';

export function MetricSelector() {
  const styles = useStyles2(getStylesMetricSelector);
  const [metricSearchTerm, setMetricSearchTerm] = useState('');
  const { metrics, selectedMetric, seriesLimit, setSeriesLimit, onMetricClick } = useMetricsBrowser();

  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => m.name === selectedMetric || m.name.includes(metricSearchTerm));
  }, [metrics, selectedMetric, metricSearchTerm]);

  return (
    <div>
      <div className={styles.section}>
        <Label
          description={t(
            'grafana-prometheus.components.metric-selector.label-select-metric',
            'Once a metric is selected only possible labels are shown. Labels are limited by the series limit below.'
          )}
        >
          <Trans i18nKey="grafana-prometheus.components.metric-selector.select-a-metric">1. Select a metric</Trans>
        </Label>
        <div>
          <Input
            onChange={(e) => setMetricSearchTerm(e.currentTarget.value)}
            aria-label={t(
              'grafana-prometheus.components.metric-selector.aria-label-filter-expression-for-metric',
              'Filter expression for metric'
            )}
            value={metricSearchTerm}
            data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.selectMetric}
          />
        </div>
        <Label
          description={t(
            'grafana-prometheus.components.metric-selector.description-series-limit',
            'The limit applies to all metrics, labels, and values. Leave the field empty to use the default limit. Set to 0 to disable the limit and fetch everything — this may cause performance issues.'
          )}
        >
          <Trans i18nKey="grafana-prometheus.components.metric-selector.series-limit">Series limit</Trans>
        </Label>
        <div>
          <Input
            onChange={(e) => setSeriesLimit(parseInt(e.currentTarget.value.trim(), 10))}
            aria-label={t(
              'grafana-prometheus.components.metric-selector.aria-label-limit-results-from-series-endpoint',
              'Limit results from series endpoint'
            )}
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
