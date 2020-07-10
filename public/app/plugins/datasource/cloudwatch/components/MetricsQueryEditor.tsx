import React, { PureComponent, ChangeEvent } from 'react';
import isEmpty from 'lodash/isEmpty';

import { ExploreQueryFieldProps } from '@grafana/data';
import { LegacyForms, ValidationEvents, EventsWithValidation, Icon } from '@grafana/ui';
const { Input, Switch } = LegacyForms;
import { CloudWatchQuery, CloudWatchMetricsQuery } from '../types';
import { CloudWatchDatasource } from '../datasource';
import { QueryField, Alias, MetricsQueryFieldsEditor } from './';

export type Props = ExploreQueryFieldProps<CloudWatchDatasource, CloudWatchQuery>;

interface State {
  showMeta: boolean;
}

const idValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: value => new RegExp(/^$|^[a-z][a-zA-Z0-9_]*$/).test(value),
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
  statistics,
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
    statistics: isEmpty(statistics) ? ['Average'] : statistics,
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

  render() {
    const { data, onRunQuery } = this.props;
    const metricsQuery = this.props.query as CloudWatchMetricsQuery;
    const { showMeta } = this.state;
    const query = normalizeQuery(metricsQuery);
    const metaDataExist = data && Object.values(data).length && data.state === 'Done';

    return (
      <>
        <MetricsQueryFieldsEditor {...{ ...this.props, query }}></MetricsQueryFieldsEditor>
        {query.statistics.length <= 1 && (
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
        )}
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
                  metaDataExist &&
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
          {showMeta && metaDataExist && (
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
                {data?.series?.[0]?.meta?.gmdMeta?.map(({ ID, Expression, Period }: any) => (
                  <tr key={ID}>
                    <td>{ID}</td>
                    <td>{Expression}</td>
                    <td>{Period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  }
}
