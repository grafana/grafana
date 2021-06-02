import { TemplateParamType, TemplateParamUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRulesListResponseRule } from '../AlertRules.types';
import { formatRules } from '../AlertRules.utils';

export const rulesStubs: AlertRulesListResponseRule[] = [
  {
    rule_id: 'test 1',
    channels: [],
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
        type: 'FLOAT',
        float: 15,
      },
    ],
    template: {
      name: 'test 1',
      summary: 'Test 1',
      params: [
        {
          name: 'threshold',
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: 'a threshold',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 10,
          },
        },
      ],
    },
    expr:
      'sum by (node_name) (mongodb_ss_connections{conn_type="current"}) * 1024 * 1024↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> [[ .threshold ]]',
  },
  {
    rule_id: 'test 2',
    channels: [{ channel_id: 'test_ch', summary: 'Test Channel' }],
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
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: 'a threshold',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 75,
          },
        },
      ],
    },
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
  {
    rule_id: 'test 3',
    channels: [{ channel_id: 'test_ch', summary: 'Test Channel' }],
    created_at: '2020-11-25T16:53:39.366Z',
    disabled: false,
    params: [
      {
        name: 'threshold',
        type: 'FLOAT',
        float: 70,
      },
    ],
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
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: 'a threshold',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 80,
          },
        },
      ],
    },
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
  {
    rule_id: 'test 4',
    channels: [
      { channel_id: 'test_ch', summary: 'Test Channel' },
      { channel_id: 'test_ch_2', summary: 'Test Channel 2' },
    ],
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
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: 'a threshold',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 75,
          },
        },
      ],
    },
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
  {
    rule_id: 'test 5',
    channels: [{ channel_id: 'test_ch', summary: 'Test Channel' }],
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
    params: [
      {
        name: 'threshold',
        type: 'FLOAT',
        float: 75,
      },
    ],
    template: {
      name: 'test 5',
      summary: 'Test 5',
      params: [
        {
          name: 'threshold',
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: 'a threshold',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 75,
          },
        },
      ],
    },
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
  {
    rule_id: 'test 6',
    channels: [{ channel_id: 'test_ch', summary: 'Test Channel' }],
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
      name: 'test_template',
      summary: 'Test Template',
      params: [
        {
          name: 'threshold',
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: 'a threshold',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 75,
          },
        },
      ],
    },
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
];

export const formattedRulesStubs = formatRules(rulesStubs);
