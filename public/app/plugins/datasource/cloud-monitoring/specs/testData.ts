import { PluginType } from '@grafana/data';
import { GoogleAuthType } from '@grafana/google-sdk';

import CloudMonitoringDatasource from '../datasource';

export const metricDescriptors = [
  {
    name: 'projects/grafana-prod/metricDescriptors/agent.googleapis.com/agent/api_request_count',
    labels: [
      {
        key: 'state',
        description: 'Request state',
      },
    ],
    metricKind: 'CUMULATIVE',
    valueType: 'INT64',
    unit: '1',
    description: 'API request count',
    displayName: 'API Request Count',
    type: 'agent.googleapis.com/agent/api_request_count',
    metadata: {
      launchStage: 'GA',
      samplePeriod: '60s',
      ingestDelay: '0s',
    },
  },
  {
    name: 'projects/grafana-prod/metricDescriptors/agent.googleapis.com/agent/log_entry_count',
    labels: [
      {
        key: 'response_code',
        description: 'HTTP response code',
      },
    ],
    metricKind: 'CUMULATIVE',
    valueType: 'INT64',
    unit: '1',
    description: 'Count of log entry writes',
    displayName: 'Log Entry Count',
    type: 'agent.googleapis.com/agent/log_entry_count',
    metadata: {
      launchStage: 'GA',
      samplePeriod: '60s',
      ingestDelay: '0s',
    },
  },
];

export const newMockDatasource = () =>
  new CloudMonitoringDatasource({
    id: 1,
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
