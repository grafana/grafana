import * as React from 'react';

import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { ModifyExportRuleForm } from '../rule-editor/alert-rule-form/ModifyExportRuleForm';

export default function ExportNewGrafanaRule() {
  return (
    <ExportNewGrafanaRuleWrapper>
      <ModifyExportRuleForm />
    </ExportNewGrafanaRuleWrapper>
  );
}

interface ExportNewGrafanaRuleWrapperProps {
  children: React.ReactNode;
}

function ExportNewGrafanaRuleWrapper({ children }: ExportNewGrafanaRuleWrapperProps) {
  return (
    <AlertingPageWrapper
      navId="alert-list"
      pageNav={{
        text: 'Export new Grafana rule',
        subTitle: 'Export a new rule definition in Terraform(HCL) format. Any changes you make will not be saved.',
      }}
    >
      {children}
    </AlertingPageWrapper>
  );
}
