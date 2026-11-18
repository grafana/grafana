import { Factory } from 'fishery';
import { keyBy } from 'lodash';

import { type DataSourceInstanceSettings, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
// Test-only: this file is never bundled, so the published package keeps no /internal import.
// eslint-disable-next-line no-restricted-imports
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
  meta: {
    id: 'prometheus',
    name: 'Prometheus',
    type: PluginType.datasource,
    module: '',
    baseUrl: '',
    alerting: true,
    info: {
      author: { name: '' },
      description: '',
      links: [],
      logos: { small: '', large: '' },
      screenshots: [],
      updated: '',
      version: '',
    },
  },
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
