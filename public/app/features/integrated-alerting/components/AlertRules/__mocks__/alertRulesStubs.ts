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
    template: {
      params: [
        {
          name: 'threshold',
          value: true,
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
    template: {
      params: [
        {
          name: 'threshold',
          value: 75,
          unit: '%',
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
          value: 80,
          unit: '%',
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
    template: {
      params: [
        {
          name: 'threshold',
          value: 100,
          unit: 'GB/min',
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
          value: 30,
          unit: '%',
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
          value: 30,
          unit: '%',
        },
      ],
    },
  },
];
