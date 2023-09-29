import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAsync } from 'react-use';

import { Stack } from '@grafana/experimental';
import { Button, CustomScrollbar, LoadingPlaceholder } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
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

  const existing = Boolean(ruleForm); // always should be true
  const notifyApp = useAppNotification();
  const returnTo = !queryParams['returnTo'] ? '/alerting/list' : String(queryParams['returnTo']);

  const [showExporter, setShowExporter] = useState<ModifyExportMode | undefined>(undefined);

  const [conditionErrorMsg, setConditionErrorMsg] = useState('');
  const [evaluateEvery, setEvaluateEvery] = useState(ruleForm?.evaluateEvery ?? MINUTE);

  const checkAlertCondition = (msg = '') => {
    setConditionErrorMsg(msg);
  };

  const submit = (exportFor: ModifyExportMode) => {
    if (conditionErrorMsg !== '') {
      notifyApp.error(conditionErrorMsg);
      return;
    }
    setShowExporter(exportFor);
  };

  const onClose = useCallback(() => {
    setShowExporter(undefined);
  }, [setShowExporter]);

  const actionButtons = [
    <Link to={returnTo} key="cancel">
      <Button size="sm" variant="secondary" onClick={() => null}>
        Cancel
      </Button>
    </Link>,
    <Button key="export-rule" size="sm" onClick={formAPI.handleSubmit(() => submit('rule'))}>
      Export Rule
    </Button>,
    <Button key="export-group" size="sm" onClick={formAPI.handleSubmit(() => submit('group'))}>
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
        {showExporter && <GrafanaRuleDesignExporter exportMode={showExporter} onClose={onClose} />}
      </FormProvider>
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
  exportMode: ModifyExportMode;
}

const useGetPayloadToExport = (values: RuleFormValues, exportMode: ModifyExportMode) => {
  const rulerGroupDto = useGetGroup(values.folder?.title ?? '', values.group);
  const grafanaRuleDto = useMemo(() => formValuesToRulerGrafanaRuleDTO(values), [values]);
  const includeRulesInGroup = exportMode === 'group';

  const payload: ModifyExportPayload = useMemo(
    () =>
      rulerGroupDto?.value?.rules
        ? {
            ...rulerGroupDto?.value,
            rules: [...(includeRulesInGroup ? rulerGroupDto.value.rules : []), grafanaRuleDto],
          }
        : {
            name: values.group,
            rules: [grafanaRuleDto],
          },
    [rulerGroupDto.value, grafanaRuleDto, values.group, includeRulesInGroup]
  );

  return { payload, loadingGroup: rulerGroupDto.loading };
};

const GrafanaRuleDesignExportPreview = ({ exportFormat, onClose, exportMode }: GrafanaRuleDesignExportPreviewProps) => {
  const [getExport, exportData] = alertRuleApi.endpoints.exportModifiedRuleGroup.useMutation();
  const { getValues } = useFormContext<RuleFormValues>();
  const values = useMemo(() => getValues(), [getValues]);
  const { loadingGroup, payload } = useGetPayloadToExport(values, exportMode);

  const nameSpace = values.folder?.title ?? '';

  useEffect(() => {
    !loadingGroup && getExport({ payload, format: exportFormat, nameSpace: nameSpace });
  }, [nameSpace, exportFormat, payload, getExport, loadingGroup]);

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
}

export const GrafanaRuleDesignExporter = React.memo(({ onClose, exportMode }: GrafanaRuleDesignExporterProps) => {
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
      <GrafanaRuleDesignExportPreview exportFormat={activeTab} onClose={onClose} exportMode={exportMode} />
    </GrafanaExportDrawer>
  );
});

GrafanaRuleDesignExporter.displayName = 'GrafanaRuleDesignExporter';
