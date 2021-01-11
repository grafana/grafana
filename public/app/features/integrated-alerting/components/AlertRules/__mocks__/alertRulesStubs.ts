import { AlertRulesListResponseRule } from '../AlertRules.types';
import { formatRules } from '../AlertRules.utils';

export const rulesStubs: AlertRulesListResponseRule[] = [
  {
    rule_id: 'test 1',
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
      name: 'test 1',
      summary: 'Test 1',
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
    channels: [],
  },
  {
    rule_id: 'test 2',
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
      name: 'test 2',
      summary: 'Test 2',
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
    channels: [],
  },
  {
    rule_id: 'test 3',
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
      name: 'test 3',
      summary: 'Test 3',
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
    channels: [],
  },
  {
    rule_id: 'test 4',
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
      name: 'test 4',
      summary: 'Test 4',
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
    channels: [],
  },
  {
    rule_id: 'test 5',
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
      name: 'test 5',
      summary: 'Test 5',
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
    channels: [],
  },
  {
    rule_id: 'test 6',
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
      name: 'test 6',
      summary: 'Test 6',
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
    channels: [],
  },
];

export const formattedRulesStubs = formatRules(rulesStubs);
