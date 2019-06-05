import React from 'react';
import { ExploreQueryFieldProps, DataSourceApi } from '@grafana/ui';
// @ts-ignore
import Cascader from 'rc-cascader';

import InfluxQuery from './influx_query';
import { AdHocFilterField, KeyValuePair } from 'app/features/explore/AdHocFilterField';
import { TemplateSrv } from 'app/features/templating/template_srv';
import InfluxDatasource from './datasource';
import { InfluxQueryBuilder } from './query_builder';

export interface Props extends ExploreQueryFieldProps<DataSourceApi<InfluxQuery>, InfluxQuery> {}

export interface State {
  measurements: string[];
  measurement: string;
}

export class InfluxLogQueryField extends React.Component<Props, State> {
  state: State = { measurements: [], measurement: null };

  async componentDidMount() {
    const { datasource } = this.props;
    const influxDataSource = (datasource as any) as InfluxDatasource;
    const queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, influxDataSource.database);
    const query = queryBuilder.buildExploreQuery('MEASUREMENTS');
    const influxMeasurements = await influxDataSource.metricFindQuery(query);
    const measurements = influxMeasurements.map(influxMeasurement => ({
      label: influxMeasurement.text,
      value: influxMeasurement.text,
    }));

    this.setState({ measurements });
  }

  onMeasurementsChange = (values: string[]) => {
    const { query } = this.props;
    const measurement = values[0];
    this.setState({ measurement }, () => {
      this.onPairsChanged((query as any).tags);
    });
  };

  onPairsChanged = (pairs: KeyValuePair[]) => {
    const { measurement } = this.state;
    const query = new InfluxQuery(
      {
        resultFormat: 'table',
        groupBy: [],
        select: [[{ type: 'field', params: ['*'] }]],
        tags: pairs,
        measurement,
      },
      new TemplateSrv()
    );

    this.props.onChange(query.target);
  };

  render() {
    const { datasource } = this.props;
    const { measurements, measurement } = this.state;
    const cascadeText = measurement ? `Measurements (${measurement})` : 'Measurements';

    return (
      <div className="gf-form-inline gf-form-inline--nowrap">
        <div className="gf-form flex-shrink-0">
          <Cascader options={measurements} onChange={this.onMeasurementsChange}>
            <button className="gf-form-label gf-form-label--btn">
              {cascadeText} <i className="fa fa-caret-down" />
            </button>
          </Cascader>
        </div>
        <div className="flex-shrink-1 flex-flow-column-nowrap">
          <AdHocFilterField onPairsChanged={this.onPairsChanged} datasource={datasource} />
        </div>
      </div>
    );
  }
}
