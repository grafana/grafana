import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useToggle } from 'react-use';

import { Stack } from '@grafana/experimental';
import { Button, CustomScrollbar } from '@grafana/ui';

import { AppChromeUpdate } from '../../../../../core/components/AppChrome/AppChromeUpdate';
import { RuleFormValues } from '../../types/rule-form';
import { MINUTE } from '../../utils/rule-form';
import { GrafanaExportDrawer } from '../export/GrafanaExportDrawer';
import { RuleExportFormats } from '../export/providers';

import { AlertRuleNameInput } from './AlertRuleNameInput';
import AnnotationsStep from './AnnotationsStep';
import { GrafanaEvaluationBehavior } from './GrafanaEvaluationBehavior';
import { NotificationsStep } from './NotificationsStep';
import { QueryAndExpressionsStep } from './query-and-alert-condition/QueryAndExpressionsStep';

interface GrafanaRuleDesignerFormProps {
  alertUid?: string;
  ruleForm?: RuleFormValues;
}

export function GrafanaRuleDesigner({ ruleForm, alertUid }: GrafanaRuleDesignerFormProps) {
  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues: ruleForm,
    shouldFocusError: true,
  });

  const existing = Boolean(ruleForm);

  const [showExporter, toggleShowExporter] = useToggle(false);

  const [conditionErrorMsg, setConditionErrorMsg] = useState('');
  const [evaluateEvery, setEvaluateEvery] = useState(ruleForm?.evaluateEvery ?? MINUTE);

  const checkAlertCondition = (msg = '') => {
    setConditionErrorMsg(msg);
  };

  const actionButtons = [
    <Button key="cancel" size="sm" variant="secondary" onClick={() => toggleShowExporter(false)}>
      Cancel
    </Button>,
    <Button key="export" size="sm" onClick={() => toggleShowExporter(true)}>
      Export
    </Button>,
  ];

  return (
    <>
      <AppChromeUpdate actions={actionButtons} />
      <FormProvider {...formAPI}>
        {/*<AppChromeUpdate actions={actionButtons} />*/}
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
      {showExporter && <GrafanaRuleDesignExporter onClose={toggleShowExporter} />}
    </>
  );
}

interface GrafanaRuleDesignExporterProps {
  onClose: () => void;
}

export const GrafanaRuleDesignExporter = ({ onClose }: GrafanaRuleDesignExporterProps) => {
  const [activeTab, setActiveTab] = useState<RuleExportFormats>('yaml');

  return (
    <GrafanaExportDrawer activeTab={activeTab} onTabChange={setActiveTab} onClose={onClose}>
      TODO
    </GrafanaExportDrawer>
  );
};
