import { TemplateParamType, TemplateParamUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRuleSeverity, AlertRulesListResponseRule } from '../AlertRules.types';
import { formatRules } from '../AlertRules.utils';

export const rulesStubs: AlertRulesListResponseRule[] = [
  {
    rule_id: 'test 1',
    name: 'Test 1',
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
    default_for: '120s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_CRITICAL',
    default_severity: AlertRuleSeverity.SEVERITY_CRITICAL,
    template_name: 'test 1',
    expr_template: '',
    summary: 'Database down - HR - Prod',
    params_values: [
      {
        name: 'threshold',
        type: 'FLOAT',
        float: 15,
      },
    ],
    params_definitions: [
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
    expr:
      'sum by (node_name) (mongodb_ss_connections{conn_type="current"}) * 1024 * 1024↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> [[ .threshold ]]',
  },
  {
    rule_id: 'test 2',
    name: 'test 2',
    template_name: 'test 2',
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
    default_for: '300s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_WARNING',
    default_severity: AlertRuleSeverity.SEVERITY_WARNING,
    expr_template: '',
    summary: 'High CPU load - Sales - Prod',
    params_values: [
      {
        name: 'threshold',
        type: 'FLOAT',
        float: 75,
      },
    ],
    params_definitions: [
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
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
  {
    rule_id: 'test 3',
    name: 'Test 3',
    template_name: 'test 3',
    channels: [{ channel_id: 'test_ch', summary: 'Test Channel' }],
    created_at: '2020-11-25T16:53:39.366Z',
    disabled: false,
    params_values: [
      {
        name: 'threshold',
        type: 'FLOAT',
        float: 70,
      },
    ],
    params_definitions: [
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
    default_for: '300s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_ERROR',
    default_severity: AlertRuleSeverity.SEVERITY_ERROR,
    expr_template: '',
    summary: 'High memory consumption - Mnfcg - Dev',
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
  {
    rule_id: 'test 4',
    name: 'Test 4',
    template_name: 'test 4',
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
    default_for: '300s',
    last_notified: '',
    severity: 'SEVERITY_WARNING',
    default_severity: AlertRuleSeverity.SEVERITY_WARNING,
    summary: 'High network throughput in - Mnfcg - Dev',
    params_values: [
      {
        name: 'threshold',
        type: 'FLOAT',
        float: 75,
      },
    ],
    params_definitions: [
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
    expr_template: '',
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
  {
    rule_id: 'test 5',
    name: 'Test 5',
    template_name: 'test 5',
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
    default_for: '1500s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_NOTICE',
    default_severity: AlertRuleSeverity.SEVERITY_NOTICE,
    summary: 'Low memory consumption - Sales - Dev',
    params_values: [
      {
        name: 'threshold',
        type: 'FLOAT',
        float: 75,
      },
    ],
    params_definitions: [
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
    expr_template: '',
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
  {
    rule_id: 'test 6',
    name: 'Test 6',
    template_name: 'test_template',
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
    params_definitions: [
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
    for: '10s',
    default_for: '10s',
    last_notified: '2020-11-25T16:53:39.366Z',
    severity: 'SEVERITY_NOTICE',
    default_severity: AlertRuleSeverity.SEVERITY_NOTICE,
    summary: 'Low memory consumption - Sales - Dev',
    expr_template: '',
    expr:
      'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
  },
];

export const formattedRulesStubs = formatRules(rulesStubs);
