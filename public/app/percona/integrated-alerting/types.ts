import { CSSProperties } from 'react';

import { Folder } from 'app/features/alerting/unified/components/rule-editor/RuleFolderPicker';
import { Template } from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.types';
import { FiltersForm } from 'app/percona/integrated-alerting/components/TemplateForm/TemplateForm.types';
import { Severity } from 'app/percona/shared/core';

export interface UploadAlertRuleTemplatePayload {
  yaml: string;
}

export interface TemplatedAlertFormValues {
  duration: string;
  filters: FiltersForm[];
  ruleName: string;
  severity: keyof typeof Severity | null;
  template: Template | null;
  folder: Folder | null;
  group: string;
  evaluateEvery: string;
}

declare module 'react-table' {
  interface Row {
    isExpanded: boolean;
    getToggleRowExpandedProps?: () => void;
  }

  interface HeaderGroup {
    className?: string;
    style?: CSSProperties;
  }
}
