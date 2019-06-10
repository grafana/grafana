import React from 'react';
import { ExploreQueryFieldProps } from '@grafana/ui';
// @ts-ignore
import Cascader from 'rc-cascader';

import InfluxQueryModel from '../influx_query_model';
import { AdHocFilterField, KeyValuePair } from 'app/features/explore/AdHocFilterField';
import { TemplateSrv } from 'app/features/templating/template_srv';
import InfluxDatasource from '../datasource';
import { InfluxQueryBuilder } from '../query_builder';
import { InfluxQuery, InfluxOptions } from '../types';
import { CascaderOption } from '../../loki/components/LokiQueryFieldForm';

export interface Props extends ExploreQueryFieldProps<InfluxDatasource, InfluxQuery, InfluxOptions> {}

export interface State {
  measurements: CascaderOption[];
  measurement: string;
  field: string;
}

export class InfluxLogsQueryField extends React.PureComponent<Props, State> {
  templateSrv: TemplateSrv = new TemplateSrv();
  state: State = { measurements: [], measurement: null, field: null };

  async componentDidMount() {
    const { datasource } = this.props;
    const queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, datasource.database);
    const measureMentsQuery = queryBuilder.buildExploreQuery('MEASUREMENTS');
    const influxMeasurements = await datasource.metricFindQuery(measureMentsQuery);

    const measurements = [];
    for (let index = 0; index < influxMeasurements.length; index++) {
      const measurementObj = influxMeasurements[index];
      const queryBuilder = new InfluxQueryBuilder({ measurement: measurementObj.text, tags: [] }, datasource.database);
      const fieldsQuery = queryBuilder.buildExploreQuery('FIELDS');
      const influxFields = await datasource.metricFindQuery(fieldsQuery);
      const fields = influxFields.map((field: any) => ({
        label: field.text,
        value: field.text,
        children: [],
      }));
      measurements.push({
        label: measurementObj.text,
        value: measurementObj.text,
        children: fields,
      });
    }

    this.setState({ measurements });
  }

  onMeasurementsChange = async (values: string[]) => {
    const { query } = this.props;
    const measurement = values[0];
    const field = values[1];

    this.setState({ measurement, field }, () => {
      this.onPairsChanged((query as any).tags);
    });
  };

  onPairsChanged = (pairs: KeyValuePair[]) => {
    const { query } = this.props;
    const { measurement, field } = this.state;
    const queryModel = new InfluxQueryModel(
      {
        ...query,
        resultFormat: 'table',
        groupBy: [],
        select: [[{ type: 'field', params: [field] }]],
        tags: pairs,
        limit: '1000',
        measurement,
      },
      this.templateSrv
    );

    this.props.onChange(queryModel.target);
  };

  render() {
    const { datasource } = this.props;
    const { measurements, measurement, field } = this.state;
    const cascadeText = measurement ? `Measurements (${measurement}/${field})` : 'Measurements';

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
          {measurement && <AdHocFilterField onPairsChanged={this.onPairsChanged} datasource={datasource} />}
        </div>
      </div>
    );
  }
}
