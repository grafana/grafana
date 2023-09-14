import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

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

type RuleDesignExportMode = 'rule' | 'group';

export function GrafanaRuleDesigner({ ruleForm, alertUid }: GrafanaRuleDesignerFormProps) {
  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues: ruleForm,
    shouldFocusError: true,
  });

  const existing = Boolean(ruleForm);

  const [showExporter, setShowExporter] = useState<RuleDesignExportMode | undefined>(undefined);

  const [conditionErrorMsg, setConditionErrorMsg] = useState('');
  const [evaluateEvery, setEvaluateEvery] = useState(ruleForm?.evaluateEvery ?? MINUTE);

  const checkAlertCondition = (msg = '') => {
    setConditionErrorMsg(msg);
  };

  const actionButtons = [
    <Button key="cancel" size="sm" variant="secondary" onClick={() => null}>
      Cancel
    </Button>,
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
  exportMode: RuleDesignExportMode;
}

export const GrafanaRuleDesignExporter = ({ onClose, exportMode }: GrafanaRuleDesignExporterProps) => {
  const [activeTab, setActiveTab] = useState<RuleExportFormats>('yaml');
  const title = exportMode === 'rule' ? 'Export Rule' : 'Export Group';

  return (
    <GrafanaExportDrawer title={title} activeTab={activeTab} onTabChange={setActiveTab} onClose={onClose}>
      TODO
    </GrafanaExportDrawer>
  );
};
