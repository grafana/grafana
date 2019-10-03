import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { CloudWatchQuery } from '../types';
import { FormField, QueryEditorProps, Segment, SegmentAsync } from '@grafana/ui';
import DataSource, { Options } from '../datasource';
import { Stats } from './Stats';

type Props = QueryEditorProps<DataSource, CloudWatchQuery, Options>;

interface State {
  regions: SelectableValue<string>[];
  namespaces: SelectableValue<string>[];
  metricNames: SelectableValue<string>[];
}

export class CloudWatchQueryEditor extends PureComponent<Props, State> {
  state: State = { regions: [], namespaces: [], metricNames: [] };

  componentDidMount() {
    this.loadRegions().then(regions => this.setState({ ...this.state, regions }));
    this.props.datasource
      .metricFindQuery('namespaces()')
      .then((namespaces: SelectableValue<string>[]) => this.setState({ ...this.state, namespaces }));
  }

  loadRegions = async () => {
    const regions = await this.props.datasource.metricFindQuery('regions()');
    return [{ label: 'default', value: 'default' }, ...regions];
  };

  loadMetricNames = async () => {
    const { namespace, region } = this.props.query;
    return this.props.datasource.metricFindQuery(`metrics(${namespace},${region})`);
  };

  render() {
    const { query, onChange } = this.props;
    const { regions, namespaces } = this.state;
    console.log('this.props', this.props);

    return (
      <>
        <div className="gf-form inline">
          <FormField
            className="query-keyword"
            width={24}
            label="Region"
            inputEl={
              <Segment value={query.region} options={regions} onChange={region => onChange({ ...query, region })} />
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
                    onChange={namespace => onChange({ ...query, namespace })}
                  />
                  <SegmentAsync
                    value={query.metricName}
                    loadOptions={this.loadMetricNames}
                    onChange={metricName => onChange({ ...query, metricName })}
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
              inputEl={<Stats values={query.statistics} onChange={statistics => onChange({ ...query, statistics })} />}
            />
          </div>
        </div>
      </>
    );
  }
}
