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
