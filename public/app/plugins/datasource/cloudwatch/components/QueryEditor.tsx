import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { CloudWatchQuery } from '../types';
import { Input, QueryEditorProps, Segment, SegmentAsync, ValidationEvents, EventsWithValidation } from '@grafana/ui';
import DataSource, { Options } from '../datasource';
import { Stats, Dimensions, FormField } from './';

type Props = QueryEditorProps<DataSource, CloudWatchQuery, Options>;

interface State {
  regions: Array<SelectableValue<string>>;
  namespaces: Array<SelectableValue<string>>;
  metricNames: Array<SelectableValue<string>>;
}

const idValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: value => {
        console.log(value);
        return false;
      },
      errorMessage: 'Do some nice validation here...',
    },
  ],
};

export class CloudWatchQueryEditor extends PureComponent<Props, State> {
  state: State = { regions: [], namespaces: [], metricNames: [] };

  componentDidMount() {
    const { datasource } = this.props;
    Promise.all([this.loadRegions(), datasource.metricFindQuery('namespaces()')]).then(([regions, namespaces]) => {
      this.setState({ ...this.state, regions, namespaces });
    });
  }

  loadRegions = async () => {
    const regions = await this.props.datasource.metricFindQuery('regions()');
    return [{ label: 'default', value: 'default' }, ...regions];
  };

  loadMetricNames = async () => {
    const { namespace, region } = this.props.query;
    return this.props.datasource.metricFindQuery(`metrics(${namespace},${region})`);
  };

  onChange(query: CloudWatchQuery) {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  }

  render() {
    const { query, datasource } = this.props;
    const { regions, namespaces } = this.state;
    return (
      <>
        <FormField
          className="inline query-keyword"
          width={24}
          grow
          label="Region"
          inputEl={
            <Segment value={query.region} options={regions} onChange={region => this.onChange({ ...query, region })} />
          }
        />
        <div className="gf-form inline">
          <FormField
            className="query-keyword"
            label="Metric"
            inputEl={
              <>
                <Segment
                  value={query.namespace}
                  options={namespaces}
                  onChange={namespace => this.onChange({ ...query, namespace })}
                />
                <SegmentAsync
                  value={query.metricName}
                  loadOptions={this.loadMetricNames}
                  onChange={metricName => this.onChange({ ...query, metricName })}
                />
              </>
            }
          />
          <FormField
            className="query-keyword"
            labelWidth={4}
            label="Stats"
            inputEl={
              <Stats values={query.statistics} onChange={statistics => this.onChange({ ...query, statistics })} />
            }
          />
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
        <FormField
          className="inline query-keyword"
          grow
          label="Dimensions"
          inputEl={
            <Dimensions
              dimensions={query.dimensions}
              onChange={dimensions => this.onChange({ ...query, dimensions })}
              loadKeys={() => datasource.getDimensionKeys(query.namespace, query.region)}
              loadValues={newKey => {
                const { [newKey]: value, ...newDimensions } = query.dimensions;
                return datasource.getDimensionValues(
                  query.region,
                  query.namespace,
                  query.metricName,
                  newKey,
                  newDimensions
                );
              }}
            />
          }
        />
        <FormField
          className="inline query-keyword"
          grow
          label="Id"
          inputEl={<Input width={16} onChange={console.log} validationEvents={idValidationEvents} />}
        />
      </>
    );
  }
}
