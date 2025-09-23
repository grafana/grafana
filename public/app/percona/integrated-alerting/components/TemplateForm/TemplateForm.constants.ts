import { SelectableValue } from '@grafana/data';
import { Severity } from 'app/percona/shared/core';

import { TemplateParamType } from '../AlertRuleTemplate/AlertRuleTemplate.types';

// TODO: generate SEVERITY_OPTIONS from its type definitions
export const SEVERITY_OPTIONS: Array<SelectableValue<keyof typeof Severity>> = [
  {
    value: 'SEVERITY_EMERGENCY',
    label: Severity.SEVERITY_EMERGENCY,
  },
  {
    value: 'SEVERITY_ALERT',
    label: Severity.SEVERITY_ALERT,
  },
  {
    value: 'SEVERITY_CRITICAL',
    label: Severity.SEVERITY_CRITICAL,
  },
  {
    value: 'SEVERITY_ERROR',
    label: Severity.SEVERITY_ERROR,
  },
  {
    value: 'SEVERITY_WARNING',
    label: Severity.SEVERITY_WARNING,
  },
  {
    value: 'SEVERITY_NOTICE',
    label: Severity.SEVERITY_NOTICE,
  },
  {
    value: 'SEVERITY_INFO',
    label: Severity.SEVERITY_INFO,
  },
  {
    value: 'SEVERITY_DEBUG',
    label: Severity.SEVERITY_DEBUG,
  },
];

// We define our default evaluation interval as 60s
// 'for' can't be less than that, hence this minimum
export const MINIMUM_DURATION_VALUE = 60;

export const TYPE_TO_KEY_MAP: Record<TemplateParamType, 'bool' | 'float' | 'string'> = {
  PARAM_TYPE_BOOL: 'bool',
  PARAM_TYPE_FLOAT: 'float',
  PARAM_TYPE_STRING: 'string',
};
