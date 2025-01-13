import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, InputGroup } from '@grafana/experimental';
import { Button, ComponentSize, InlineField, InlineFieldRow, useStyles2 } from '@grafana/ui';
import { Combobox, ComboboxOption } from '@grafana/ui/src/components/Combobox/Combobox';
import { getPropertiesForButtonSize } from '@grafana/ui/src/components/Forms/commonStyles';

import { PrometheusDatasource } from '../../datasource';
import { regexifyLabelValuesQueryString } from '../parsingUtils';
import { QueryBuilderLabelFilter } from '../shared/types';
import { PromVisualQuery } from '../types';

import { MetricsModal } from './metrics-modal';
import { tracking } from './metrics-modal/state/helpers';

export interface MetricComboboxProps {
  metricLookupDisabled: boolean;
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onGetMetrics: () => Promise<SelectableValue[]>;
  datasource: PrometheusDatasource;
  labelsFilters: QueryBuilderLabelFilter[];
  onBlur?: () => void;
  variableEditor?: boolean;
}

const INLINE_FIELD_WIDTH = 20;
const BUTTON_SIZE: ComponentSize = 'md';

export function MetricCombobox({
  datasource,
  query,
  onChange,
  onGetMetrics,
  labelsFilters,
  variableEditor,
}: Readonly<MetricComboboxProps>) {
  const [metricsModalOpen, setMetricsModalOpen] = useState(false);

  /**
   * Gets label_values response from prometheus API for current autocomplete query string and any existing labels filters
   */
  const getMetricLabels = useCallback(
    async (query: string) => {
      const results = await datasource.metricFindQuery(formatKeyValueStringsForLabelValuesQuery(query, labelsFilters));

      const resultsOptions = results.map((result) => {
        return {
          label: result.text,
          value: result.text,
        };
      });
      return resultsOptions;
    },
    [datasource, labelsFilters]
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

  const styles = useStyles2(getMectricComboboxStyles);

  const asyncSelect = () => {
    return (
      <InputGroup>
        <Combobox
          placeholder="Select metric"
          width="auto"
          minWidth={25}
          options={loadOptions}
          value={query.metric}
          onChange={onComboboxChange}
          createCustomValue
        />
        <Button
          size={BUTTON_SIZE}
          tooltip="Open metrics explorer"
          aria-label="Open metrics explorer"
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
        />
      )}
      {variableEditor ? (
        <span className={styles.adaptToParentVariableEditor}>
          <InlineFieldRow>
            <InlineField
              label="Metric"
              labelWidth={INLINE_FIELD_WIDTH}
              tooltip={<div>Optional: returns a list of label values for the label name in the specified metric.</div>}
            >
              {asyncSelect()}
            </InlineField>
          </InlineFieldRow>
        </span>
      ) : (
        <span className={styles.adaptToParentQueryEditor}>
          <EditorFieldGroup>
            <EditorField label="Metric">{asyncSelect()}</EditorField>
          </EditorFieldGroup>
        </span>
      )}
    </>
  );
}

export const formatPrometheusLabelFiltersToString = (
  queryString: string,
  labelsFilters: QueryBuilderLabelFilter[] | undefined
): string => {
  const filterArray = labelsFilters ? formatPrometheusLabelFilters(labelsFilters) : [];

  return `label_values({__name__=~".*${queryString}"${filterArray ? filterArray.join('') : ''}},__name__)`;
};

export const formatPrometheusLabelFilters = (labelsFilters: QueryBuilderLabelFilter[]): string[] => {
  return labelsFilters.map((label) => {
    return `,${label.label}="${label.value}"`;
  });
};

/**
 * Reformat the query string and label filters to return all valid results for current query editor state
 */
const formatKeyValueStringsForLabelValuesQuery = (query: string, labelsFilters?: QueryBuilderLabelFilter[]): string => {
  const queryString = regexifyLabelValuesQueryString(query);

  return formatPrometheusLabelFiltersToString(queryString, labelsFilters);
};

const getMectricComboboxStyles = (theme: GrafanaTheme2) => {
  const { height } = getPropertiesForButtonSize(BUTTON_SIZE, theme);
  const buttonSpace = parseInt(theme.spacing(height), 10);
  const inlineFieldSpace = parseInt(theme.spacing(INLINE_FIELD_WIDTH), 10);
  const widthToSubstract = inlineFieldSpace + buttonSpace;
  return {
    adaptToParentQueryEditor: css({
      // Take metrics explorer button into account
      maxWidth: `calc(100% - ${buttonSpace}px)`,
    }),
    adaptToParentVariableEditor: css({
      maxWidth: '100%',
      display: 'flex',
      '[class*="InlineFieldRow"]': {
        '> div': {
          'label + div': {
            // Take label and the metrics explorer button into account
            maxWidth: `calc(100% - ${widthToSubstract}px)`,
          },
        },
      },
    }),
  };
};
