import { AlertRulesListResponseRule } from '../AlertRules.types';

export const rulesStubs: AlertRulesListResponseRule[] = [
  {
    created_at: '2020-11-25T16:53:39.366Z',
    disabled: false,
    filters: [
      {
        key: 'environment',
        type: 'EQUAL',
        value: 'prod',
      },
      {
        key: 'app',
        type: 'EQUAL',
        value: 'wordpress',
      },
      {
        key: 'cluster',
        type: 'EQUAL',
        value: 'PXCCluster1',
      },
    ],
    for: '120s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_CRITICAL',
    summary: 'Database down - HR - Prod',
    params: [
      {
        name: 'threshold',
        type: 'BOOL',
        bool: true,
      },
    ],
    template: {
      params: [
        {
          name: 'threshold',
          type: 'BOOL',
          bool: {
            default: true,
          },
        },
      ],
    },
  },
  {
    created_at: '2020-11-25T16:53:39.366Z',
    disabled: false,
    filters: [
      {
        key: 'environment',
        type: 'EQUAL',
        value: 'prod',
      },
      {
        key: 'app',
        type: 'EQUAL',
        value: 'wordpress',
      },
      {
        key: 'cluster',
        type: 'EQUAL',
        value: 'PXCCluster1',
      },
    ],
    for: '300s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_WARNING',
    summary: 'High CPU load - Sales - Prod',
    params: [
      {
        name: 'threshold',
        type: 'FLOAT',
        float: 75,
      },
    ],
    template: {
      params: [
        {
          name: 'threshold',
          type: 'FLOAT',
          float: {
            default: 75,
          },
          unit: 'PERCENTAGE',
        },
      ],
    },
  },
  {
    created_at: '2020-11-25T16:53:39.366Z',
    disabled: false,
    filters: [
      {
        key: 'environment',
        type: 'EQUAL',
        value: 'prod',
      },
      {
        key: 'app',
        type: 'EQUAL',
        value: 'wordpress',
      },
      {
        key: 'cluster',
        type: 'EQUAL',
        value: 'PXCCluster1',
      },
    ],
    for: '300s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_ERROR',
    summary: 'High memory consumption - Mnfcg - Dev',
    template: {
      params: [
        {
          name: 'threshold',
          type: 'FLOAT',
          float: {
            default: 80,
          },
          unit: 'PERCENTAGE',
        },
      ],
    },
  },
  {
    created_at: '2020-11-25T16:53:39.366Z',
    disabled: true,
    filters: [
      {
        key: 'environment',
        type: 'EQUAL',
        value: 'prod',
      },
      {
        key: 'app',
        type: 'EQUAL',
        value: 'wordpress',
      },
      {
        key: 'cluster',
        type: 'EQUAL',
        value: 'PXCCluster1',
      },
    ],
    for: '300s',
    last_notified: '',
    severity: 'SEVERITY_WARNING',
    summary: 'High network throughput in - Mnfcg - Dev',
    params: [
      {
        name: 'threshold',
        type: 'FLOAT',
        float: 75,
      },
    ],
    template: {
      params: [
        {
          name: 'threshold',
          type: 'FLOAT',
          float: {
            default: 75,
          },
          unit: 'PERCENTAGE',
        },
      ],
    },
  },
  {
    created_at: '2020-11-25T16:53:39.366Z',
    disabled: false,
    filters: [
      {
        key: 'environment',
        type: 'EQUAL',
        value: 'prod',
      },
      {
        key: 'app',
        type: 'EQUAL',
        value: 'wordpress',
      },
      {
        key: 'cluster',
        type: 'EQUAL',
        value: 'PXCCluster1',
      },
    ],
    for: '1500s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_NOTICE',
    summary: 'Low memory consumption - Sales - Dev',
    template: {
      params: [
        {
          name: 'threshold',
          type: 'FLOAT',
          float: {
            default: 75,
          },
          unit: 'PERCENTAGE',
        },
      ],
    },
  },
  {
    created_at: '2020-11-25T16:53:39.366Z',
    disabled: false,
    filters: [
      {
        key: 'environment',
        type: 'EQUAL',
        value: 'prod',
      },
      {
        key: 'app',
        type: 'EQUAL',
        value: 'wordpress',
      },
      {
        key: 'cluster',
        type: 'EQUAL',
        value: 'PXCCluster1',
      },
    ],
    for: '10s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_NOTICE',
    summary: 'Low memory consumption - Sales - Dev',
    template: {
      params: [
        {
          name: 'threshold',
          type: 'FLOAT',
          float: {
            default: 75,
          },
          unit: 'PERCENTAGE',
        },
      ],
    },
  },
];
