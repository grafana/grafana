import { Factory } from 'fishery';
import { keyBy } from 'lodash';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';

export const DataSourceInstanceSettingsFactory = Factory.define<DataSourceInstanceSettings>(({ sequence }) => ({
  id: sequence,
  uid: `data-source-${sequence}`,
  name: `Data source ${sequence}`,
  type: 'prometheus',
  access: 'proxy',
  url: '',
  readOnly: false,
  jsonData: {},
  meta: { id: 'prometheus', name: 'Prometheus', type: 'datasource', alerting: true } as DataSourcePluginMeta,
}));

/**
 * Seeds the runtime data source cache that getDataSourceInstanceList and
 * getDataSourceInstanceSettings read from, and config.datasources to match.
 */
export function setupDataSources(...dataSources: DataSourceInstanceSettings[]) {
  const byName = keyBy(dataSources, (ds) => ds.name);
  setDataSourceInstanceSettings(byName);
  // eslint-disable-next-line @grafana/no-config-datasources
  config.datasources = byName;
}
