import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { CloudWatchQuery } from '../types';
import {
  FormField,
  QueryEditorProps,
  Segment,
  SegmentAsync,
  ValidationEvents,
  EventsWithValidation,
} from '@grafana/ui';
import DataSource, { Options } from '../datasource';
import { Stats } from './Stats';
import { Dimensions } from './Dimensions';

type Props = QueryEditorProps<DataSource, CloudWatchQuery, Options>;

interface State {
  regions: SelectableValue<string>[];
  namespaces: SelectableValue<string>[];
  metricNames: SelectableValue<string>[];
}

const idValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: value => {
        console.log(value);
        return false;
      },
      errorMessage: 'Not a valid duration',
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
        <div className="gf-form inline">
          <FormField
            className="query-keyword"
            width={24}
            label="Region"
            inputEl={
              <Segment
                value={query.region}
                options={regions}
                onChange={region => this.onChange({ ...query, region })}
              />
            }
          />
        </div>
        <div className="gf-form inline">
          <div className="gf-form">
            <FormField
              className="query-keyword"
              width={24}
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
          </div>
          <div className="gf-form">
            <FormField
              className="query-keyword"
              width={24}
              label="Stats"
              inputEl={
                <Stats values={query.statistics} onChange={statistics => this.onChange({ ...query, statistics })} />
              }
            />
          </div>
        </div>
        <div className="gf-form inline">
          <FormField
            className="query-keyword"
            width={24}
            label="Dimensions"
            inputEl={
              <Dimensions
                dimensions={query.dimensions}
                onChange={dimensions => {
                  console.log('dimensions changed', { dimensions });
                  this.onChange({ ...query, dimensions });
                }}
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
        </div>
        <div className="gf-form inline">
          <FormField
            className="query-keyword"
            width={16}
            label="Id"
            onChange={console.log}
            validationEvents={idValidationEvents}
          />
        </div>
      </>
    );
  }
}
