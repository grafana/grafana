import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Stack } from '@grafana/experimental';
import { Button, CustomScrollbar, LinkButton } from '@grafana/ui';

import { AppChromeUpdate } from '../../../../../../core/components/AppChrome/AppChromeUpdate';
import { RuleFormValues } from '../../../types/rule-form';
import { MINUTE } from '../../../utils/rule-form';
import { GrafanaExportDrawer } from '../../export/GrafanaExportDrawer';
import { allGrafanaExportProviders, ExportFormats } from '../../export/providers';
import { AlertRuleNameInput } from '../AlertRuleNameInput';
import AnnotationsStep from '../AnnotationsStep';
import { GrafanaEvaluationBehavior } from '../GrafanaEvaluationBehavior';
import { NotificationsStep } from '../NotificationsStep';
import { QueryAndExpressionsStep } from '../query-and-alert-condition/QueryAndExpressionsStep';

interface ModifyExportRuleFormProps {
  alertUid?: string;
  ruleForm?: RuleFormValues;
}

type ModifyExportMode = 'rule' | 'group';

export function ModifyExportRuleForm({ ruleForm, alertUid }: ModifyExportRuleFormProps) {
  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues: ruleForm,
    shouldFocusError: true,
  });

  const existing = Boolean(ruleForm);
  const returnTo = `/alerting/list`;

  const [showExporter, setShowExporter] = useState<ModifyExportMode | undefined>(undefined);

  const [conditionErrorMsg, setConditionErrorMsg] = useState('');
  console.log('conditionErrorMsg', conditionErrorMsg);
  const [evaluateEvery, setEvaluateEvery] = useState(ruleForm?.evaluateEvery ?? MINUTE);

  const checkAlertCondition = (msg = '') => {
    setConditionErrorMsg(msg);
  };

  const actionButtons = [
    <LinkButton href={returnTo} key="cancel" size="sm" variant="secondary">
      Cancel
    </LinkButton>,
    <Button key="export-rule" size="sm" onClick={() => setShowExporter('rule')}>
      Export Rule
    </Button>,
    <Button key="export-group" size="sm" onClick={() => setShowExporter('group')}>
      Export Group
    </Button>,
  ];

  return (
    <>
      <FormProvider {...formAPI}>
        <AppChromeUpdate actions={actionButtons} />
        <form onSubmit={(e) => e.preventDefault()}>
          <div>
            <CustomScrollbar autoHeightMin="100%" hideHorizontalTrack={true}>
              <Stack direction="column" gap={3}>
                {/* Step 1 */}
                <AlertRuleNameInput />
                {/* Step 2 */}
                <QueryAndExpressionsStep editingExistingRule={existing} onDataChange={checkAlertCondition} />
                {/* Step 3-4-5 */}

                <GrafanaEvaluationBehavior
                  evaluateEvery={evaluateEvery}
                  setEvaluateEvery={setEvaluateEvery}
                  existing={Boolean(existing)}
                />

                {/* Step 4 & 5 */}
                {/* Annotations only for cloud and Grafana */}
                <AnnotationsStep />
                {/* Notifications step*/}
                <NotificationsStep alertUid={alertUid} />
              </Stack>
            </CustomScrollbar>
          </div>
        </form>
      </FormProvider>
      {showExporter && (
        <GrafanaRuleDesignExporter exportMode={showExporter} onClose={() => setShowExporter(undefined)} />
      )}
    </>
  );
}

interface GrafanaRuleDesignExporterProps {
  onClose: () => void;
  exportMode: ModifyExportMode;
}

export const GrafanaRuleDesignExporter = ({ onClose, exportMode }: GrafanaRuleDesignExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');
  const title = exportMode === 'rule' ? 'Export Rule' : 'Export Group';

  return (
    <GrafanaExportDrawer
      title={title}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      TODO
    </GrafanaExportDrawer>
  );
};
