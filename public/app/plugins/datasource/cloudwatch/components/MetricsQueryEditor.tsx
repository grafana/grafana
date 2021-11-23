import React, { PureComponent, ChangeEvent } from 'react';

import { QueryEditorProps, PanelData } from '@grafana/data';
import { LegacyForms, ValidationEvents, EventsWithValidation, Icon } from '@grafana/ui';
const { Input, Switch } = LegacyForms;
import { CloudWatchQuery, CloudWatchMetricsQuery, CloudWatchJsonData, ExecutedQueryPreview } from '../types';
import { CloudWatchDatasource } from '../datasource';
import { QueryField, Alias, MetricsQueryFieldsEditor } from './';

export type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>;

interface State {
  showMeta: boolean;
}

const idValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: (value) => new RegExp(/^$|^[a-z][a-zA-Z0-9_]*$/).test(value),
      errorMessage: 'Invalid format. Only alphanumeric characters and underscores are allowed',
    },
  ],
};

export const normalizeQuery = ({
  namespace,
  metricName,
  expression,
  dimensions,
  region,
  id,
  alias,
  statistic,
  period,
  ...rest
}: CloudWatchMetricsQuery): CloudWatchMetricsQuery => {
  const normalizedQuery = {
    namespace: namespace || '',
    metricName: metricName || '',
    expression: expression || '',
    dimensions: dimensions || {},
    region: region || 'default',
    id: id || '',
    alias: alias || '',
    statistic: statistic ?? 'Average',
    period: period || '',
    ...rest,
  };
  return !rest.hasOwnProperty('matchExact') ? { ...normalizedQuery, matchExact: true } : normalizedQuery;
};

export class MetricsQueryEditor extends PureComponent<Props, State> {
  state: State = { showMeta: false };

  componentDidMount(): void {
    const metricsQuery = this.props.query as CloudWatchMetricsQuery;
    const query = normalizeQuery(metricsQuery);
    this.props.onChange(query);
  }

  onChange(query: CloudWatchMetricsQuery) {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  }

  getExecutedQueryPreview(data?: PanelData): ExecutedQueryPreview {
    if (!(data?.series.length && data?.series[0].meta?.custom)) {
      return {
        executedQuery: '',
        period: '',
        id: '',
      };
    }

    return {
      executedQuery: data?.series[0].meta.executedQueryString ?? '',
      period: data.series[0].meta.custom['period'],
      id: data.series[0].meta.custom['id'],
    };
  }

  render() {
    const { data, onRunQuery } = this.props;
    const metricsQuery = this.props.query as CloudWatchMetricsQuery;
    const { showMeta } = this.state;
    const query = normalizeQuery(metricsQuery);
    const executedQueryPreview = this.getExecutedQueryPreview(data);
    return (
      <>
        <MetricsQueryFieldsEditor {...{ ...this.props, query }}></MetricsQueryFieldsEditor>
        <div className="gf-form-inline">
          <div className="gf-form">
            <QueryField
              label="Id"
              tooltip="Id can include numbers, letters, and underscore, and must start with a lowercase letter."
            >
              <Input
                className="gf-form-input width-8"
                onBlur={onRunQuery}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  this.onChange({ ...metricsQuery, id: event.target.value })
                }
                validationEvents={idValidationEvents}
                value={query.id}
              />
            </QueryField>
          </div>
          <div className="gf-form gf-form--grow">
            <QueryField
              className="gf-form--grow"
              label="Expression"
              tooltip="Optionally you can add an expression here. Please note that if a math expression that is referencing other queries is being used, it will not be possible to create an alert rule based on this query"
            >
              <Input
                className="gf-form-input"
                onBlur={onRunQuery}
                value={query.expression || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  this.onChange({ ...metricsQuery, expression: event.target.value })
                }
              />
            </QueryField>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <QueryField label="Period" tooltip="Minimum interval between points in seconds">
              <Input
                className="gf-form-input width-8"
                value={query.period || ''}
                placeholder="auto"
                onBlur={onRunQuery}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  this.onChange({ ...metricsQuery, period: event.target.value })
                }
              />
            </QueryField>
          </div>
          <div className="gf-form">
            <QueryField
              label="Alias"
              tooltip="Alias replacement variables: {{metric}}, {{stat}}, {{namespace}}, {{region}}, {{period}}, {{label}}, {{YOUR_DIMENSION_NAME}}"
            >
              <Alias
                value={metricsQuery.alias}
                onChange={(value: string) => this.onChange({ ...metricsQuery, alias: value })}
              />
            </QueryField>
            <Switch
              label="Match Exact"
              labelClass="query-keyword"
              tooltip="Only show metrics that exactly match all defined dimension names."
              checked={metricsQuery.matchExact}
              onChange={() =>
                this.onChange({
                  ...metricsQuery,
                  matchExact: !metricsQuery.matchExact,
                })
              }
            />
            <label className="gf-form-label">
              <a
                onClick={() =>
                  executedQueryPreview &&
                  this.setState({
                    showMeta: !showMeta,
                  })
                }
              >
                <Icon name={showMeta ? 'angle-down' : 'angle-right'} /> {showMeta ? 'Hide' : 'Show'} Query Preview
              </a>
            </label>
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
          {showMeta && (
            <table className="filter-table form-inline">
              <thead>
                <tr>
                  <th>Metric Data Query ID</th>
                  <th>Metric Data Query Expression</th>
                  <th>Period</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{executedQueryPreview.id}</td>
                  <td>{executedQueryPreview.executedQuery}</td>
                  <td>{executedQueryPreview.period}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  }
}
