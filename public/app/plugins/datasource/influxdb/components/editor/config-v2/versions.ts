interface AuthMethod {
  type: 'Basic' | 'Token';
  fields: string[];
}

interface QueryLanguageConfig {
  name: string; // SQL, InfluxQL, Flux
  fields: Array<string | AuthMethod>;
}

interface DetectionMethod {
  urlContains?: string[];
  pingHeaderResponse?: Record<string, string>;
}

interface InfluxDBVariant {
  name: string; // e.g., OSS 1.x, OSS 2.x
  queryLanguages: QueryLanguageConfig[];
  detectionMethod: DetectionMethod;
}

interface InfluxDBProduct {
  name: string; // e.g., InfluxDB Cloud Dedicated
  variants?: InfluxDBVariant[]; // if applicable
  queryLanguages?: QueryLanguageConfig[]; // if no variants
  detectionMethod?: DetectionMethod; // if no variants
}

// Complete Data Structure:
export const INFLUXDB_VERSION_MAP: InfluxDBProduct[] = [
  {
    name: 'InfluxDB Cloud Dedicated',
    queryLanguages: [
      { name: 'SQL', fields: ['Host', 'Database', 'Token'] },
      { name: 'InfluxQL', fields: ['Host', 'Database', 'Token'] },
    ],
    detectionMethod: {
      urlContains: ['influxdb.io'],
    },
  },
  {
    name: 'InfluxDB Cloud Serverless',
    queryLanguages: [
      { name: 'SQL', fields: ['Host', 'Bucket', 'Token'] },
      { name: 'InfluxQL', fields: ['Host', 'Bucket', 'Token'] },
      { name: 'Flux', fields: ['Host', 'Organization', 'Token', 'Default bucket'] },
    ],
    detectionMethod: {
      urlContains: ['us-east-1-1.aws.cloud2.influxdata.com', 'eu-central-1-1.aws.cloud2.influxdata.com'],
    },
  },
  {
    name: 'InfluxDB Clustered',
    queryLanguages: [
      { name: 'SQL', fields: ['Host', 'Database', 'Token'] },
      { name: 'InfluxQL', fields: ['URL', 'Database', 'Token'] },
    ],
    detectionMethod: {
      pingHeaderResponse: {
        'x-influxdb-version': '\\s*influxqlbridged-development',
      },
    },
  },
  {
    name: 'InfluxDB Enterprise 1.x',
    queryLanguages: [
      { name: 'InfluxQL', fields: ['URL', 'Database', 'User', 'Password'] },
      { name: 'Flux', fields: ['URL', 'User', 'Password', 'Default database'] },
    ],
    detectionMethod: {
      pingHeaderResponse: {
        'x-influxdb-build': 'Enterprise (needs confirmation)',
      },
    },
  },
  {
    name: 'InfluxDB Enterprise 3.x',
    queryLanguages: [
      { name: 'SQL', fields: ['URL', 'Token'] },
      { name: 'InfluxQL', fields: ['URL', 'Token'] },
    ],
    detectionMethod: {
      pingHeaderResponse: {
        'x-influxdb-build': 'TBD',
      },
    },
  },
  {
    name: 'InfluxDB Cloud (TSM)',
    queryLanguages: [
      { name: 'InfluxQL', fields: ['URL', 'Database', 'Token'] },
      { name: 'Flux', fields: ['URL', 'Organization', 'Token', 'Default bucket'] },
    ],
    detectionMethod: {
      urlContains: [
        'us-west-2-1.aws.cloud2.influxdata.com',
        'us-west-2-2.aws.cloud2.influxdata.com',
        'us-east-1-1.aws.cloud2.influxdata.com',
        'eu-central-1-1.aws.cloud2.influxdata.com',
        'us-central1-1.gcp.cloud2.influxdata.com',
        'westeurope-1.azure.cloud2.influxdata.com',
        'eastus-1.azure.cloud2.influxdata.com',
      ],
    },
  },
  {
    name: 'InfluxDB Cloud 1',
    queryLanguages: [{ name: 'InfluxQL', fields: ['URL', 'Database', 'Username', 'Password'] }],
    detectionMethod: {
      urlContains: ['influxcloud.net'],
    },
  },
  {
    name: 'InfluxDB Core',
    variants: [
      {
        name: 'InfluxDB OSS 1.x',
        queryLanguages: [
          { name: 'InfluxQL', fields: ['URL', 'Database', 'Username', 'Password'] },
          { name: 'Flux', fields: ['URL', 'Username', 'Password', 'Default database'] },
        ],
        detectionMethod: {
          pingHeaderResponse: {
            'x-influxdb-build': 'OSS',
            'x-influxdb-version': '^1\\.',
          },
        },
      },
      {
        name: 'InfluxDB OSS 2.x',
        queryLanguages: [
          {
            name: 'InfluxQL',
            fields: [
              'URL',
              'Database',
              { type: 'Basic', fields: ['Username', 'Password'] },
              { type: 'Token', fields: ['Token'] },
            ],
          },
          { name: 'Flux', fields: ['URL', 'Token', 'Default bucket'] },
        ],
        detectionMethod: {
          pingHeaderResponse: {
            'x-influxdb-build': 'OSS',
            'x-influxdb-version': '^2\\.',
          },
        },
      },
    ],
  },
];
