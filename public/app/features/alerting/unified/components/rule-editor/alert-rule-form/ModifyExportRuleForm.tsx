import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useAsync } from 'react-use';

import { Button, CustomScrollbar, LinkButton, LoadingPlaceholder, Stack } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { AppChromeUpdate } from '../../../../../../core/components/AppChrome/AppChromeUpdate';
import { RulerRuleDTO, RulerRuleGroupDTO } from '../../../../../../types/unified-alerting-dto';
import { alertRuleApi, ModifyExportPayload } from '../../../api/alertRuleApi';
import { fetchRulerRulesGroup } from '../../../api/ruler';
import { useDataSourceFeatures } from '../../../hooks/useCombinedRule';
import { RuleFormValues } from '../../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { formValuesToRulerGrafanaRuleDTO, MINUTE } from '../../../utils/rule-form';
import { isGrafanaRulerRule } from '../../../utils/rules';
import { FileExportPreview } from '../../export/FileExportPreview';
import { GrafanaExportDrawer } from '../../export/GrafanaExportDrawer';
import { allGrafanaExportProviders, ExportFormats } from '../../export/providers';
import { AlertRuleNameInput } from '../AlertRuleNameInput';
import AnnotationsStep from '../AnnotationsStep';
import { GrafanaEvaluationBehavior } from '../GrafanaEvaluationBehavior';
import { NotificationsStep } from '../NotificationsStep';
import { QueryAndExpressionsStep } from '../query-and-alert-condition/QueryAndExpressionsStep';

interface ModifyExportRuleFormProps {
  alertUid: string;
  ruleForm?: RuleFormValues;
}

export function ModifyExportRuleForm({ ruleForm, alertUid }: ModifyExportRuleFormProps) {
  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues: ruleForm,
    shouldFocusError: true,
  });
  const [queryParams] = useQueryParams();

  const existing = Boolean(ruleForm); // always should be true
  const notifyApp = useAppNotification();
  const returnTo = !queryParams['returnTo'] ? '/alerting/list' : String(queryParams['returnTo']);

  const [exportData, setExportData] = useState<RuleFormValues | undefined>(undefined);

  const [conditionErrorMsg, setConditionErrorMsg] = useState('');
  const [evaluateEvery, setEvaluateEvery] = useState(ruleForm?.evaluateEvery ?? MINUTE);

  const onInvalid = (): void => {
    notifyApp.error('There are errors in the form. Please correct them and try again!');
  };

  const checkAlertCondition = (msg = '') => {
    setConditionErrorMsg(msg);
  };

  const submit = (exportData: RuleFormValues | undefined) => {
    if (conditionErrorMsg !== '') {
      notifyApp.error(conditionErrorMsg);
      return;
    }
    setExportData(exportData);
  };

  const onClose = useCallback(() => {
    setExportData(undefined);
  }, [setExportData]);

  const actionButtons = [
    <LinkButton href={returnTo} key="cancel" size="sm" variant="secondary" onClick={() => submit(undefined)}>
      Cancel
    </LinkButton>,
    <Button key="export-rule" size="sm" onClick={formAPI.handleSubmit((formValues) => submit(formValues), onInvalid)}>
      Export
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
                  enableProvisionedGroups={true}
                />

                {/* Step 4 & 5 */}
                {/* Notifications step*/}
                <NotificationsStep alertUid={alertUid} />
                {/* Annotations only for cloud and Grafana */}
                <AnnotationsStep />
              </Stack>
            </CustomScrollbar>
          </div>
        </form>
        {exportData && <GrafanaRuleDesignExporter exportValues={exportData} onClose={onClose} uid={alertUid} />}
      </FormProvider>
    </>
  );
}

const useGetGroup = (nameSpaceUID: string, group: string) => {
  const { dsFeatures } = useDataSourceFeatures(GRAFANA_RULES_SOURCE_NAME);

  const rulerConfig = dsFeatures?.rulerConfig;

  const targetGroup = useAsync(async () => {
    return rulerConfig ? await fetchRulerRulesGroup(rulerConfig, nameSpaceUID, group) : undefined;
  }, [rulerConfig, nameSpaceUID, group]);

  return targetGroup;
};

interface GrafanaRuleDesignExportPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
  exportValues: RuleFormValues;
  uid: string;
}
export const getPayloadToExport = (
  uid: string,
  formValues: RuleFormValues,
  existingGroup: RulerRuleGroupDTO<RulerRuleDTO> | null | undefined
): ModifyExportPayload => {
  const grafanaRuleDto = formValuesToRulerGrafanaRuleDTO(formValues);

  const updatedRule = { ...grafanaRuleDto, grafana_alert: { ...grafanaRuleDto.grafana_alert, uid: uid } };
  if (existingGroup?.rules) {
    // we have to update the rule in the group in the same position if it exists, otherwise we have to add it at the end
    let alreadyExistsInGroup = false;
    const updatedRules = existingGroup.rules.map((rule: RulerRuleDTO) => {
      if (isGrafanaRulerRule(rule) && rule.grafana_alert.uid === uid) {
        alreadyExistsInGroup = true;
        return updatedRule;
      } else {
        return rule;
      }
    });
    if (!alreadyExistsInGroup) {
      // we have to add the updated rule at the end of the group
      updatedRules.push(updatedRule);
    }
    return {
      ...existingGroup,
      rules: updatedRules,
    };
  } else {
    // we have to create a new group with the updated rule
    return {
      name: existingGroup?.name ?? '',
      rules: [updatedRule],
    };
  }
};

const useGetPayloadToExport = (values: RuleFormValues, uid: string) => {
  const rulerGroupDto = useGetGroup(values.folder?.uid ?? '', values.group);
  const payload: ModifyExportPayload = useMemo(() => {
    return getPayloadToExport(uid, values, rulerGroupDto?.value);
  }, [uid, rulerGroupDto, values]);
  return { payload, loadingGroup: rulerGroupDto.loading };
};

const GrafanaRuleDesignExportPreview = ({
  exportFormat,
  exportValues,
  onClose,
  uid,
}: GrafanaRuleDesignExportPreviewProps) => {
  const [getExport, exportData] = alertRuleApi.endpoints.exportModifiedRuleGroup.useMutation();
  const { loadingGroup, payload } = useGetPayloadToExport(exportValues, uid);

  const nameSpaceUID = exportValues.folder?.uid ?? '';

  useEffect(() => {
    !loadingGroup && getExport({ payload, format: exportFormat, nameSpaceUID });
  }, [nameSpaceUID, exportFormat, payload, getExport, loadingGroup]);

  if (exportData.isLoading) {
    return <LoadingPlaceholder text="Loading...." />;
  }

  const downloadFileName = `modify-export-${payload.name}-${uid}-${new Date().getTime()}`;

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
  exportValues: RuleFormValues;
  uid: string;
}

export const GrafanaRuleDesignExporter = React.memo(
  ({ onClose, exportValues, uid }: GrafanaRuleDesignExporterProps) => {
    const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

    return (
      <GrafanaExportDrawer
        title={'Export Group'}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={onClose}
        formatProviders={Object.values(allGrafanaExportProviders)}
      >
        <GrafanaRuleDesignExportPreview
          exportFormat={activeTab}
          onClose={onClose}
          exportValues={exportValues}
          uid={uid}
        />
      </GrafanaExportDrawer>
    );
  }
);

GrafanaRuleDesignExporter.displayName = 'GrafanaRuleDesignExporter';
