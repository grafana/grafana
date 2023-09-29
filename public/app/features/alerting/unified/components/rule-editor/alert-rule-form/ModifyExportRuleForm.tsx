import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAsync } from 'react-use';

import { Stack } from '@grafana/experimental';
import { Button, CustomScrollbar, LoadingPlaceholder } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { AppChromeUpdate } from '../../../../../../core/components/AppChrome/AppChromeUpdate';
import { alertRuleApi, ModifyExportPayload } from '../../../api/alertRuleApi';
import { fetchRulerRulesGroup } from '../../../api/ruler';
import { useDataSourceFeatures } from '../../../hooks/useCombinedRule';
import { RuleFormValues } from '../../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { formValuesToRulerGrafanaRuleDTO, MINUTE } from '../../../utils/rule-form';
import { FileExportPreview } from '../../export/FileExportPreview';
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
  const [queryParams] = useQueryParams();

  const existing = Boolean(ruleForm);
  const returnTo = !queryParams['returnTo'] ? '/alerting/list' : String(queryParams['returnTo']);

  const [showExporter, setShowExporter] = useState<ModifyExportMode | undefined>(undefined);

  const [conditionErrorMsg, setConditionErrorMsg] = useState('');
  console.log('conditionErrorMsg', conditionErrorMsg);
  const [evaluateEvery, setEvaluateEvery] = useState(ruleForm?.evaluateEvery ?? MINUTE);
  const [updatedValues, setUpdatedValues] = useState<RuleFormValues | undefined>(undefined);

  const checkAlertCondition = (msg = '') => {
    setConditionErrorMsg(msg);
  };

  const submit = (values: RuleFormValues, exportFor: ModifyExportMode) => {
    setUpdatedValues(values);
    setShowExporter(exportFor);
  };

  const actionButtons = [
    <Link to={returnTo} key="cancel">
      <Button size="sm" variant="secondary" onClick={() => null}>
        Cancel
      </Button>
    </Link>,
    <Button key="export-rule" size="sm" onClick={formAPI.handleSubmit((values) => submit(values, 'rule'))}>
      Export Rule
    </Button>,
    <Button key="export-group" size="sm" onClick={formAPI.handleSubmit((values) => submit(values, 'group'))}>
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
        <GrafanaRuleDesignExporter
          exportMode={showExporter}
          onClose={() => setShowExporter(undefined)}
          values={updatedValues}
        />
      )}
    </>
  );
}

const useGetGroup = (nameSpace: string, group: string) => {
  const { dsFeatures } = useDataSourceFeatures(GRAFANA_RULES_SOURCE_NAME);

  const rulerConfig = dsFeatures?.rulerConfig;

  const targetGroup = useAsync(async () => {
    return rulerConfig ? await fetchRulerRulesGroup(rulerConfig, nameSpace, group) : undefined;
  }, [rulerConfig, nameSpace, group]);

  return targetGroup;
};

interface GrafanaRuleDesignExportPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
  values: RuleFormValues;
  exportMode: ModifyExportMode;
}

const GrafanaRuleDesignExportPreview = ({
  values,
  exportFormat,
  onClose,
  exportMode,
}: GrafanaRuleDesignExportPreviewProps) => {
  const [getExport, exportData] = alertRuleApi.endpoints.exportModifiedRuleGroup.useMutation();

  const targetGroup = useGetGroup(values.folder?.title ?? '', values.group);

  const formRule = useMemo(() => formValuesToRulerGrafanaRuleDTO(values), [values]);
  const includeRulesInGroup = exportMode === 'group';

  const payload: ModifyExportPayload = useMemo(
    () =>
      targetGroup?.value?.rules
        ? {
            ...targetGroup?.value,
            rules: [...(includeRulesInGroup ? targetGroup.value.rules : []), formRule],
          }
        : {
            name: values.group,
            rules: [formRule],
          },
    [targetGroup.value, formRule, values.group, includeRulesInGroup]
  );

  const nameSpace = values.folder?.title ?? '';
  useEffect(() => {
    getExport({ payload, format: exportFormat, nameSpace: nameSpace });
  }, [nameSpace, exportFormat, payload, getExport]);

  const downloadFileName = `modify-export-${new Date().getTime()}`;

  if (exportData.isLoading) {
    return <LoadingPlaceholder text="Loading...." />;
  }

  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={exportData.data ?? ''}
      downloadFileName={downloadFileName}
      onClose={onClose}
    />
  );
};

interface GrafanaRuleDesignExporterProps {
  onClose: () => void;
  exportMode: ModifyExportMode;
  values?: RuleFormValues;
}

export const GrafanaRuleDesignExporter = ({ onClose, exportMode, values }: GrafanaRuleDesignExporterProps) => {
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
      {values && (
        <GrafanaRuleDesignExportPreview
          exportFormat={activeTab}
          onClose={onClose}
          values={values}
          exportMode={exportMode}
        />
      )}
    </GrafanaExportDrawer>
  );
};
