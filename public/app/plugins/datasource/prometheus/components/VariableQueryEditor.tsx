import React, { FormEvent, useCallback, useEffect, useState } from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select, TextArea } from '@grafana/ui';

import { PrometheusDatasource } from '../datasource';
import {
  migrateVariableEditorBackToVariableSupport,
  migrateVariableQueryToEditor,
} from '../migrations/variableMigration';
import { promQueryModeller } from '../querybuilder/PromQueryModeller';
import { MetricsLabelsSection } from '../querybuilder/components/MetricsLabelsSection';
import { QueryBuilderLabelFilter } from '../querybuilder/shared/types';
import { PromVisualQuery } from '../querybuilder/types';
import {
  PromOptions,
  PromQuery,
  PromVariableQuery,
  PromVariableQueryType as QueryType,
  StandardPromVariableQuery,
} from '../types';

export const variableOptions = [
  { label: 'Label names', value: QueryType.LabelNames },
  { label: 'Label values', value: QueryType.LabelValues },
  { label: 'Metrics', value: QueryType.MetricNames },
  { label: 'Query result', value: QueryType.VarQueryResult },
  { label: 'Series query', value: QueryType.SeriesQuery },
];

export type Props = QueryEditorProps<PrometheusDatasource, PromQuery, PromOptions, PromVariableQuery>;

const refId = 'PrometheusVariableQueryEditor-VariableQuery';

export const PromVariableQueryEditor = ({ onChange, query, datasource }: Props) => {
  // to select the query type, i.e. label_names, label_values, etc.
  const [qryType, setQryType] = useState<number | undefined>(undefined);
  // list of variables for each function
  const [label, setLabel] = useState('');

  const [labelNamesMatch, setLabelNamesMatch] = useState('');

  // metric is used for both label_values() and metric()
  // label_values() metric requires a whole/complete metric
  // metric() is expected to be a part of a metric string
  const [metric, setMetric] = useState('');
  // varQuery is a whole query, can include math/rates/etc
  const [varQuery, setVarQuery] = useState('');
  // seriesQuery is only a whole
  const [seriesQuery, setSeriesQuery] = useState('');

  // list of label names for label_values(), /api/v1/labels, contains the same results as label_names() function
  const [labelOptions, setLabelOptions] = useState<Array<SelectableValue<string>>>([]);

  // label filters have been added as a filter for metrics in label values query type
  const [labelFilters, setLabelFilters] = useState<QueryBuilderLabelFilter[]>([]);

  useEffect(() => {
    if (!query) {
      return;
    }
    // 1. Changing from standard to custom variable editor changes the string attr from expr to query
    // 2. jsonnet grafana as code passes a variable as a string
    const variableQuery = variableMigration(query);

    setLabelNamesMatch(variableQuery.match ?? '');
    setQryType(variableQuery.qryType);
    setLabel(variableQuery.label ?? '');
    setMetric(variableQuery.metric ?? '');
    setLabelFilters(variableQuery.labelFilters ?? []);
    setVarQuery(variableQuery.varQuery ?? '');
    setSeriesQuery(variableQuery.seriesQuery ?? '');
  }, [query]);

  // set the label names options for the label values var query
  useEffect(() => {
    if (qryType !== QueryType.LabelValues) {
      return;
    }
    const variables = datasource.getVariables().map((variable: string) => ({ label: variable, value: variable }));
    if (!metric) {
      // get all the labels
      datasource.getTagKeys().then((labelNames: Array<{ text: string }>) => {
        const names = labelNames.map(({ text }) => ({ label: text, value: text }));
        setLabelOptions([...variables, ...names]);
      });
    } else {
      // fetch the labels filtered by the metric
      const labelToConsider = [{ label: '__name__', op: '=', value: metric }];
      const expr = promQueryModeller.renderLabels(labelToConsider);

      if (datasource.hasLabelsMatchAPISupport()) {
        datasource.languageProvider.fetchSeriesLabelsMatch(expr).then((labelsIndex: Record<string, string[]>) => {
          const labelNames = Object.keys(labelsIndex);
          const names = labelNames.map((value) => ({ label: value, value: value }));
          setLabelOptions([...variables, ...names]);
        });
      } else {
        datasource.languageProvider.fetchSeriesLabels(expr).then((labelsIndex: Record<string, string[]>) => {
          const labelNames = Object.keys(labelsIndex);
          const names = labelNames.map((value) => ({ label: value, value: value }));
          setLabelOptions([...variables, ...names]);
        });
      }
    }
  }, [datasource, qryType, metric]);

  const onChangeWithVariableString = (
    updateVar: { [key: string]: QueryType | string },
    updLabelFilters?: QueryBuilderLabelFilter[]
  ) => {
    const queryVar = {
      qryType,
      label,
      metric,
      match: labelNamesMatch,
      varQuery,
      seriesQuery,
      refId: 'PrometheusVariableQueryEditor-VariableQuery',
    };

    let updateLabelFilters = updLabelFilters ? { labelFilters: updLabelFilters } : { labelFilters: labelFilters };

    const updatedVar = { ...queryVar, ...updateVar, ...updateLabelFilters };

    const queryString = migrateVariableEditorBackToVariableSupport(updatedVar);

    // setting query.query property allows for update of variable definition
    onChange({
      query: queryString,
      refId,
    });
  };

  /** Call onchange for label names query type change */
  const onQueryTypeChange = (newType: SelectableValue<QueryType>) => {
    setQryType(newType.value);
    if (newType.value === QueryType.LabelNames) {
      onChangeWithVariableString({ qryType: newType.value });
    }
  };

  /** Call onchange for label select when query type is label values */
  const onLabelChange = (newLabel: SelectableValue<string>) => {
    const newLabelvalue = newLabel && newLabel.value ? newLabel.value : '';
    setLabel(newLabelvalue);
    if (qryType === QueryType.LabelValues && newLabelvalue) {
      onChangeWithVariableString({ label: newLabelvalue });
    }
  };

  /**
   * Call onChange for MetricsLabels component change for label values query type
   * if there is a label (required) and
   * if the labels or metric are updated.
   */
  const metricsLabelsChange = (update: PromVisualQuery) => {
    setMetric(update.metric);
    setLabelFilters(update.labels);

    const updMetric = update.metric;
    const updLabelFilters = update.labels ?? [];

    if (qryType === QueryType.LabelValues && label && (updMetric || updLabelFilters)) {
      onChangeWithVariableString({ qryType, metric: updMetric }, updLabelFilters);
    }
  };

  const onLabelNamesMatchChange = (regex: string) => {
    if (qryType === QueryType.LabelNames) {
      onChangeWithVariableString({ qryType, match: regex });
    }
  };

  /**
   * Call onchange for metric change if metrics names (regex) query type
   * Debounce this because to not call the API for every keystroke.
   */
  const onMetricChange = (value: string) => {
    if (qryType === QueryType.MetricNames && value) {
      onChangeWithVariableString({ metric: value });
    }
  };

  /**
   *  Do not call onchange for variable query result when query type is var query result
   *  because the query may not be finished typing and an error is returned
   *  for incorrectly formatted series. Call onchange for blur instead.
   */
  const onVarQueryChange = (e: FormEvent<HTMLTextAreaElement>) => {
    setVarQuery(e.currentTarget.value);
  };

  /**
   *  Do not call onchange for seriesQuery when query type is series query
   *  because the series may not be finished typing and an error is returned
   *  for incorrectly formatted series. Call onchange for blur instead.
   */
  const onSeriesQueryChange = (e: FormEvent<HTMLInputElement>) => {
    setSeriesQuery(e.currentTarget.value);
  };

  const promVisualQuery = useCallback(() => {
    return { metric: metric, labels: labelFilters, operations: [] };
  }, [metric, labelFilters]);

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Query type"
          labelWidth={20}
          tooltip={
            <div>The Prometheus data source plugin provides the following query types for template variables.</div>
          }
        >
          <Select
            placeholder="Select query type"
            aria-label="Query type"
            onChange={onQueryTypeChange}
            value={qryType}
            options={variableOptions}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>

      {qryType === QueryType.LabelValues && (
        <>
          <InlineFieldRow>
            <InlineField
              label="Label"
              labelWidth={20}
              required
              aria-labelledby="label-select"
              tooltip={
                <div>
                  Returns a list of label values for the label name in all metrics unless the metric is specified.
                </div>
              }
            >
              <Select
                aria-label="label-select"
                onChange={onLabelChange}
                value={label}
                options={labelOptions}
                width={25}
                allowCustomValue
                isClearable={true}
              />
            </InlineField>
          </InlineFieldRow>
          {/* Used to select an optional metric with optional label filters */}
          <MetricsLabelsSection
            query={promVisualQuery()}
            datasource={datasource}
            onChange={metricsLabelsChange}
            variableEditor={true}
          />
        </>
      )}

      {qryType === QueryType.LabelNames && (
        <InlineFieldRow>
          <InlineField
            label="Metric regex"
            labelWidth={20}
            aria-labelledby="Metric regex"
            tooltip={<div>Returns a list of label names, optionally filtering by specified metric regex.</div>}
          >
            <Input
              type="text"
              aria-label="Metric regex"
              placeholder="Metric regex"
              value={labelNamesMatch}
              onBlur={(event) => {
                setLabelNamesMatch(event.currentTarget.value);
                onLabelNamesMatchChange(event.currentTarget.value);
              }}
              onChange={(e) => {
                setLabelNamesMatch(e.currentTarget.value);
              }}
              width={25}
            />
          </InlineField>
        </InlineFieldRow>
      )}

      {qryType === QueryType.MetricNames && (
        <InlineFieldRow>
          <InlineField
            label="Metric regex"
            labelWidth={20}
            aria-labelledby="Metric selector"
            tooltip={<div>Returns a list of metrics matching the specified metric regex.</div>}
          >
            <Input
              type="text"
              aria-label="Metric selector"
              placeholder="Metric regex"
              value={metric}
              onChange={(e) => {
                setMetric(e.currentTarget.value);
              }}
              onBlur={(e) => {
                setMetric(e.currentTarget.value);
                onMetricChange(e.currentTarget.value);
              }}
              width={25}
            />
          </InlineField>
        </InlineFieldRow>
      )}

      {qryType === QueryType.VarQueryResult && (
        <InlineFieldRow>
          <InlineField
            label="Query"
            labelWidth={20}
            tooltip={
              <div>
                Returns a list of Prometheus query results for the query. This can include Prometheus functions, i.e.
                sum(go_goroutines).
              </div>
            }
          >
            <TextArea
              type="text"
              aria-label="Prometheus Query"
              placeholder="Prometheus Query"
              value={varQuery}
              onChange={onVarQueryChange}
              onBlur={() => {
                if (qryType === QueryType.VarQueryResult && varQuery) {
                  onChangeWithVariableString({ qryType });
                }
              }}
              cols={100}
            />
          </InlineField>
        </InlineFieldRow>
      )}

      {qryType === QueryType.SeriesQuery && (
        <InlineFieldRow>
          <InlineField
            label="Series Query"
            labelWidth={20}
            tooltip={
              <div>
                Enter enter a metric with labels, only a metric or only labels, i.e.
                go_goroutines&#123;instance=&quot;localhost:9090&quot;&#125;, go_goroutines, or
                &#123;instance=&quot;localhost:9090&quot;&#125;. Returns a list of time series associated with the
                entered data.
              </div>
            }
          >
            <Input
              type="text"
              aria-label="Series Query"
              placeholder="Series Query"
              value={seriesQuery}
              onChange={onSeriesQueryChange}
              onBlur={() => {
                if (qryType === QueryType.SeriesQuery && seriesQuery) {
                  onChangeWithVariableString({ qryType });
                }
              }}
              width={100}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </>
  );
};

export function variableMigration(query: string | PromVariableQuery | StandardPromVariableQuery): PromVariableQuery {
  if (typeof query === 'string') {
    return migrateVariableQueryToEditor(query);
  } else if (query.query) {
    return migrateVariableQueryToEditor(query.query);
  } else {
    return query;
  }
}
