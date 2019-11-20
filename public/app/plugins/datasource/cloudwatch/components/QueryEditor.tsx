import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue, QueryEditorProps } from '@grafana/data';
import { Input, Segment, SegmentAsync, ValidationEvents, EventsWithValidation, Switch } from '@grafana/ui';
import { CloudWatchQuery } from '../types';
import CloudWatchDatasource from '../datasource';
import { SelectableStrings } from '../types';
import { Stats, Dimensions, QueryInlineField, QueryField, Alias } from './';

export type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery>;

interface State {
  regions: SelectableStrings;
  namespaces: SelectableStrings;
  metricNames: SelectableStrings;
  variableOptionGroup: SelectableValue<string>;
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
  state: State = { regions: [], namespaces: [], metricNames: [], variableOptionGroup: {}, showMeta: false };

  componentWillMount() {
    const { query } = this.props;

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
  }

  componentDidMount() {
    const { datasource } = this.props;
    const variableOptionGroup = {
      label: 'Template Variables',
      options: this.props.datasource.variables.map(this.toOption),
    };
    Promise.all([datasource.metricFindQuery('regions()'), datasource.metricFindQuery('namespaces()')]).then(
      ([regions, namespaces]) => {
        this.setState({
          ...this.state,
          regions: [...regions, variableOptionGroup],
          namespaces: [...namespaces, variableOptionGroup],
          variableOptionGroup,
        });
      }
    );
  }

  loadMetricNames = async () => {
    const { namespace, region } = this.props.query;
    return this.props.datasource.metricFindQuery(`metrics(${namespace},${region})`).then(this.appendTemplateVariables);
  };

  appendTemplateVariables = (values: SelectableValue[]) => [
    ...values,
    { label: 'Template Variables', options: this.props.datasource.variables.map(this.toOption) },
  ];

  toOption = (value: any) => ({ label: value, value });

  onChange(query: CloudWatchQuery) {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  }

  render() {
    const { query, datasource, onChange, onRunQuery, data } = this.props;
    const { regions, namespaces, variableOptionGroup: variableOptionGroup, showMeta } = this.state;
    const metaDataExist = data && Object.values(data).length && data.state === 'Done';
    return (
      <>
        <QueryInlineField label="Region">
          <Segment
            value={query.region || 'Select region'}
            options={regions}
            allowCustomValue
            onChange={region => this.onChange({ ...query, region })}
          />
        </QueryInlineField>

        {query.expression.length === 0 && (
          <>
            <QueryInlineField label="Namespace">
              <Segment
                value={query.namespace || 'Select namespace'}
                allowCustomValue
                options={namespaces}
                onChange={namespace => this.onChange({ ...query, namespace })}
              />
            </QueryInlineField>

            <QueryInlineField label="Metric Name">
              <SegmentAsync
                value={query.metricName || 'Select metric name'}
                allowCustomValue
                loadOptions={this.loadMetricNames}
                onChange={metricName => this.onChange({ ...query, metricName })}
              />
            </QueryInlineField>

            <QueryInlineField label="Stats">
              <Stats
                stats={datasource.standardStatistics.map(this.toOption)}
                values={query.statistics}
                onChange={statistics => this.onChange({ ...query, statistics })}
                variableOptionGroup={variableOptionGroup}
              />
            </QueryInlineField>

            <QueryInlineField label="Dimensions">
              <Dimensions
                dimensions={query.dimensions}
                onChange={dimensions => this.onChange({ ...query, dimensions })}
                loadKeys={() =>
                  datasource.getDimensionKeys(query.namespace, query.region).then(this.appendTemplateVariables)
                }
                loadValues={newKey => {
                  const { [newKey]: value, ...newDimensions } = query.dimensions;
                  return datasource
                    .getDimensionValues(query.region, query.namespace, query.metricName, newKey, newDimensions)
                    .then(this.appendTemplateVariables);
                }}
              />
            </QueryInlineField>
          </>
        )}
        {query.statistics.length <= 1 && (
          <div className="gf-form-inline">
            <div className="gf-form">
              <QueryField
                className="query-keyword"
                label="Id"
                tooltip="Id can include numbers, letters, and underscore, and must start with a lowercase letter."
              >
                <Input
                  className="gf-form-input width-8"
                  onBlur={onRunQuery}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...query, id: event.target.value })}
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
                    onChange({ ...query, expression: event.target.value })
                  }
                />
              </QueryField>
            </div>
          </div>
        )}
        <div className="gf-form-inline">
          <div className="gf-form">
            <QueryField className="query-keyword" label="Period" tooltip="Minimum interval between points in seconds">
              <Input
                className="gf-form-input width-8"
                value={query.period || ''}
                placeholder="auto"
                onBlur={onRunQuery}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...query, period: event.target.value })}
              />
            </QueryField>
          </div>
          <div className="gf-form">
            <QueryField
              className="query-keyword"
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
                    ...this.state,
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.series[0].meta.gmdMeta.map(({ ID, Expression }: any) => (
                  <tr key={ID}>
                    <td>{ID}</td>
                    <td>{Expression}</td>
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
