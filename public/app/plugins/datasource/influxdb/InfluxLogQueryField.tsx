import React from 'react';
import { ExploreQueryFieldProps, DataSourceApi } from '@grafana/ui';

import InfluxQuery from './influx_query';
import { AdHocFilterField, KeyValuePair } from 'app/features/explore/AdHocFilterField';
import { TemplateSrv } from 'app/features/templating/template_srv';

export interface Props extends ExploreQueryFieldProps<DataSourceApi<InfluxQuery>, InfluxQuery> {}

export class InfluxLogQueryField extends React.Component<Props> {
  onPairsChanged = (pairs: KeyValuePair[]) => {
    const query = new InfluxQuery(
      {
        resultFormat: 'table',
        groupBy: [],
        select: [[{ type: 'field', params: ['*'] }]],
        tags: pairs,
        measurement: 'logs',
      },
      new TemplateSrv()
    );

    this.props.onChange(query.target);
  };

  render() {
    const { datasource } = this.props;

    return <AdHocFilterField onPairsChanged={this.onPairsChanged} datasource={datasource} />;
  }
}
