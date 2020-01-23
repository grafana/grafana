import React, { PureComponent, ChangeEvent } from 'react';
import { ExploreQueryFieldProps } from '@grafana/data';
import { Input, ValidationEvents, EventsWithValidation, Switch } from '@grafana/ui';
import { CloudWatchQuery } from '../types';
import CloudWatchDatasource from '../datasource';
import { QueryField, Alias, QueryFieldsEditor } from './';

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

export class QueryEditor extends PureComponent<Props, State> {
  state: State = { showMeta: false };

  static getDerivedStateFromProps(props: Props, state: State) {
    const { query } = props;

    if (!query.namespace) {
      query.namespace = '';
    }

    if (!query.metricName) {
      query.metricName = '';
    }

    if (!query.expression) {
      query.expression = '';
    }

    if (!query.dimensions) {
      query.dimensions = {};
    }

    if (!query.region) {
      query.region = 'default';
    }

    if (!query.id) {
      query.id = '';
    }

    if (!query.alias) {
      query.alias = '';
    }

    if (!query.statistics || !query.statistics.length) {
      query.statistics = ['Average'];
    }

    if (!query.hasOwnProperty('matchExact')) {
      query.matchExact = true;
    }

    return state;
  }

  onChange(query: CloudWatchQuery) {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  }

  render() {
    const { data, query, onRunQuery } = this.props;
    const { showMeta } = this.state;
    const metaDataExist = data && Object.values(data).length && data.state === 'Done';
    return (
      <>
        <QueryFieldsEditor {...this.props}></QueryFieldsEditor>
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
                    this.onChange({ ...query, id: event.target.value })
                  }
                  validationEvents={idValidationEvents}
                  value={query.id || ''}
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
                    this.onChange({ ...query, expression: event.target.value })
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
                  this.onChange({ ...query, period: event.target.value })
                }
              />
            </QueryField>
          </div>
          <div className="gf-form">
            <QueryField
              label="Alias"
              tooltip="Alias replacement variables: {{metric}}, {{stat}}, {{namespace}}, {{region}}, {{period}}, {{label}}, {{YOUR_DIMENSION_NAME}}"
            >
              <Alias value={query.alias} onChange={(value: string) => this.onChange({ ...query, alias: value })} />
            </QueryField>
            <Switch
              label="Match Exact"
              labelClass="query-keyword"
              tooltip="Only show metrics that exactly match all defined dimension names."
              checked={query.matchExact}
              onChange={() => this.onChange({ ...query, matchExact: !query.matchExact })}
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
                <i className={`fa fa-caret-${showMeta ? 'down' : 'right'}`} /> {showMeta ? 'Hide' : 'Show'} Query
                Preview
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
                {data.series[0].meta.gmdMeta.map(({ ID, Expression, Period }: any) => (
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
