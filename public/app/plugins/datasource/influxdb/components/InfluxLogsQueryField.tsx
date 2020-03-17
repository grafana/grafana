import React from 'react';
import { ExploreQueryFieldProps } from '@grafana/data';
import { ButtonCascader, CascaderOption } from '@grafana/ui';

import InfluxQueryModel from '../influx_query_model';
import { AdHocFilterField, KeyValuePair } from 'app/features/explore/AdHocFilterField';
import { TemplateSrv } from 'app/features/templating/template_srv';
import InfluxDatasource from '../datasource';
import { InfluxQueryBuilder } from '../query_builder';
import { InfluxOptions, InfluxQuery } from '../types';

export interface Props extends ExploreQueryFieldProps<InfluxDatasource, InfluxQuery, InfluxOptions> {}

export interface State {
  measurements: CascaderOption[];
  measurement: string;
  field: string;
  error: string;
}

interface ChooserOptions {
  measurement: string;
  field: string;
  error: string;
}

// Helper function for determining if a collection of pairs are valid
// where a valid pair is either fully defined, or not defined at all, but not partially defined
export function pairsAreValid(pairs: KeyValuePair[]) {
  return (
    !pairs ||
    pairs.every(pair => {
      const allDefined = !!(pair.key && pair.operator && pair.value);
      const allEmpty = pair.key === undefined && pair.operator === undefined && pair.value === undefined;
      return allDefined || allEmpty;
    })
  );
}

function getChooserText({ measurement, field, error }: ChooserOptions): string {
  if (error) {
    return '(No measurement found)';
  }
  if (measurement) {
    return `Measurements (${measurement}/${field})`;
  }
  return 'Measurements';
}

export class InfluxLogsQueryField extends React.PureComponent<Props, State> {
  templateSrv: TemplateSrv = new TemplateSrv();
  state: State = {
    measurements: [],
    measurement: (null as unknown) as string,
    field: (null as unknown) as string,
    error: (null as unknown) as string,
  };

  async componentDidMount() {
    const { datasource } = this.props;
    try {
      const queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, datasource.database);
      const measureMentsQuery = queryBuilder.buildExploreQuery('MEASUREMENTS');
      const influxMeasurements = await datasource.metricFindQuery(measureMentsQuery);

      const measurements = [];
      for (let index = 0; index < influxMeasurements.length; index++) {
        const measurementObj = influxMeasurements[index];
        const queryBuilder = new InfluxQueryBuilder(
          { measurement: measurementObj.text, tags: [] },
          datasource.database
        );
        const fieldsQuery = queryBuilder.buildExploreQuery('FIELDS');
        const influxFields = await datasource.metricFindQuery(fieldsQuery);
        const fields: any[] = influxFields.map((field: any): any => ({
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
    } catch (error) {
      const message = error && error.message ? error.message : error;
      console.error(error);
      this.setState({ error: message });
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.query.measurement && !this.props.query.measurement) {
      this.setState({ measurement: null, field: null });
    }
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

    // Only run the query if measurement & field are set, and there are no invalid pairs
    if (measurement && field && pairsAreValid(pairs)) {
      this.props.onRunQuery();
    }
  };

  render() {
    const { datasource } = this.props;
    const { measurements, measurement, field, error } = this.state;
    const cascadeText = getChooserText({ measurement, field, error });
    const hasMeasurement = measurements && measurements.length > 0;

    return (
      <div className="gf-form-inline gf-form-inline--nowrap">
        <div className="gf-form flex-shrink-0">
          <ButtonCascader
            options={measurements}
            disabled={!hasMeasurement}
            value={[measurement, field]}
            onChange={this.onMeasurementsChange}
          >
            {cascadeText}
          </ButtonCascader>
        </div>
        <div className="flex-shrink-1 flex-flow-column-nowrap">
          {measurement && (
            <AdHocFilterField
              onPairsChanged={this.onPairsChanged}
              datasource={datasource}
              extendedOptions={{ measurement }}
            />
          )}
          {error ? (
            <span className="gf-form-label gf-form-label--transparent gf-form-label--error m-l-2">{error}</span>
          ) : null}
        </div>
      </div>
    );
  }
}
