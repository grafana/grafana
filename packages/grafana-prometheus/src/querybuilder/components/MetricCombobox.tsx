import { useCallback, useState } from 'react';

import { SelectableValue, TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { EditorField, EditorFieldGroup, InputGroup } from '@grafana/plugin-ui';
import { Button, InlineField, InlineFieldRow, Combobox, ComboboxOption } from '@grafana/ui';

import { METRIC_LABEL } from '../../constants';
import { PrometheusDatasource } from '../../datasource';
import { QueryBuilderLabelFilter } from '../shared/types';
import { PromVisualQuery } from '../types';

import { MetricsModal } from './metrics-modal/MetricsModal';
import { tracking } from './metrics-modal/state/helpers';
import { formatKeyValueStrings } from './shared/formatter';

export interface MetricComboboxProps {
  metricLookupDisabled: boolean;
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onGetMetrics: () => Promise<SelectableValue[]>;
  datasource: PrometheusDatasource;
  labelsFilters: QueryBuilderLabelFilter[];
  onBlur?: () => void;
  variableEditor?: boolean;
  timeRange: TimeRange;
}

export function MetricCombobox({
  datasource,
  query,
  onChange,
  onGetMetrics,
  labelsFilters,
  variableEditor,
  timeRange,
}: Readonly<MetricComboboxProps>) {
  const [metricsModalOpen, setMetricsModalOpen] = useState(false);

  /**
   * Gets label_values response from prometheus API for current autocomplete query string and any existing labels filters
   */
  const getMetricLabels = useCallback(
    async (query: string) => {
      const match = formatKeyValueStrings(query, labelsFilters);
      const results = await datasource.languageProvider.queryLabelValues(timeRange, METRIC_LABEL, match);

      const resultsOptions = results.map((result) => {
        return {
          label: result,
          value: result,
        };
      });
      return resultsOptions;
    },
    [datasource.languageProvider, labelsFilters, timeRange]
  );

  const onComboboxChange = useCallback(
    (opt: ComboboxOption<string> | null) => {
      onChange({ ...query, metric: opt?.value ?? '' });
    },
    [onChange, query]
  );

  const loadOptions = useCallback(
    async (input: string): Promise<ComboboxOption[]> => {
      const metrics = input.length ? await getMetricLabels(input) : await onGetMetrics();

      return metrics.map((option) => ({
        label: option.label ?? option.value,
        value: option.value,
      }));
    },
    [getMetricLabels, onGetMetrics]
  );

  const loadMetricsExplorerMetrics = useCallback(async () => {
    const allMetrics = await onGetMetrics();
    const metrics: string[] = [];
    for (const metric of allMetrics) {
      if (metric.value) {
        metrics.push(metric.value);
      }
    }

    return metrics;
  }, [onGetMetrics]);

  const asyncSelect = () => {
    return (
      <InputGroup>
        <Combobox
          placeholder={t(
            'grafana-prometheus.querybuilder.metric-combobox.async-select.placeholder-select-metric',
            'Select metric'
          )}
          width="auto"
          minWidth={25}
          options={loadOptions}
          value={query.metric}
          onChange={onComboboxChange}
          createCustomValue
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.builder.metricSelect}
        />
        <Button
          tooltip={t(
            'grafana-prometheus.querybuilder.metric-combobox.async-select.tooltip-open-metrics-explorer',
            'Open metrics explorer'
          )}
          aria-label={t(
            'grafana-prometheus.querybuilder.metric-combobox.async-select.aria-label-open-metrics-explorer',
            'Open metrics explorer'
          )}
          variant="secondary"
          icon="book-open"
          onClick={() => {
            tracking('grafana_prometheus_metric_encyclopedia_open', null, '', query);
            setMetricsModalOpen(true);
          }}
        />
      </InputGroup>
    );
  };

  return (
    <>
      {!datasource.lookupsDisabled && metricsModalOpen && (
        <MetricsModal
          datasource={datasource}
          isOpen={metricsModalOpen}
          onClose={() => setMetricsModalOpen(false)}
          query={query}
          onChange={onChange}
          initialMetrics={loadMetricsExplorerMetrics}
          timeRange={timeRange}
        />
      )}
      {variableEditor ? (
        <InlineFieldRow>
          <InlineField
            label={t('grafana-prometheus.querybuilder.metric-combobox.label-metric', 'Metric')}
            labelWidth={20}
            tooltip={
              <div>
                <Trans i18nKey="grafana-prometheus.querybuilder.metric-combobox.tooltip-metric">
                  Optional: returns a list of label values for the label name in the specified metric.
                </Trans>
              </div>
            }
          >
            {asyncSelect()}
          </InlineField>
        </InlineFieldRow>
      ) : (
        <EditorFieldGroup>
          <EditorField label={t('grafana-prometheus.querybuilder.metric-combobox.label-metric', 'Metric')}>
            {asyncSelect()}
          </EditorField>
        </EditorFieldGroup>
      )}
    </>
  );
}
