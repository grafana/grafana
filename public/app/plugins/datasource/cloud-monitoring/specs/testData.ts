import { PluginType } from '@grafana/data';
import { GoogleAuthType } from '@grafana/google-sdk';

import CloudMonitoringDatasource from '../datasource';

export const newMockDatasource = () =>
  new CloudMonitoringDatasource({
    uid: 'cm-id',
    type: 'cloud-monitoring-datasource',
    name: 'Cloud Monitoring Data Source',
    jsonData: {
      authenticationType: GoogleAuthType.JWT,
    },
    access: 'proxy',
    meta: {
      id: 'cloud-monitoring-datasource',
      name: 'Cloud Monitoring Data Source',
      type: PluginType.datasource,
      module: '',
      baseUrl: '',
      info: {
        description: '',
        screenshots: [],
        updated: '',
        version: '',
        logos: {
          small: '',
          large: '',
        },
        author: {
          name: '',
        },
        links: [],
      },
    },
    readOnly: false,
  });
