import { isEmpty, noop } from 'lodash';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { useDataSourcesWithValidRecordingTargetByUid } from '@grafana/alerting/internal';
import { buildRoutingTreeOptions, useRoutingTrees } from '@grafana/alerting/unstable';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Box,
  Collapse,
  Combobox,
  type ComboboxOption,
  Divider,
  Field,
  InlineField,
  InlineSwitch,
  Stack,
  Text,
} from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { ProvisioningAwareFolderPicker } from 'app/features/provisioning/components/Shared/ProvisioningAwareFolderPicker';
import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { CreateNewFolder } from '../../create-folder/CreateNewFolder';
import { isAutoSyncSelected } from '../Wizard/steps';
import { useRulesToImport } from '../hooks';
import { type ImportFormValues } from '../types';

import { ImportSourceCard } from './ImportSourceCard';
import { usePredictedAutoSyncIdentifier } from './useAutoSyncPrediction';
import { RULES_JOB_FIELDS, buildRulesImportJob, getRoutingTreeOptions, isStep2Valid } from './utils';

interface Step2ContentProps {
  step1Completed: boolean;
  /** Whether the user has permission to import rules */
  canImport: boolean;
}

/**
 * Step2Content - Content for the alert rules import step
 * This component contains only the form fields, without the header or action buttons
 * The WizardStep wrapper provides those
 */
export function Step2Content({ step1Completed, canImport }: Step2ContentProps) {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  const recordingTargets = useDataSourcesWithValidRecordingTargetByUid();

  const [
    rulesSource,
    rulesDatasourceName,
    rulesYamlFile,
    policyTreeName,
    namespace,
    ruleGroup,
    targetFolder,
    notificationsSource,
    notificationsDatasourceUID,
    notificationsDatasourceName,
    autoSyncNotificationsEnabled,
  ] = watch([
    'rulesSource',
    'rulesDatasourceName',
    'rulesYamlFile',
    'policyTreeName',
    'namespace',
    'ruleGroup',
    'targetFolder',
    'notificationsSource',
    'notificationsDatasourceUID',
    'notificationsDatasourceName',
    'autoSyncNotificationsEnabled',
  ]);

  // With Auto-sync the tree is named by the sync; policyTreeName is a disabled field that may hold an earlier entry.
  const autoSyncSelected = isAutoSyncSelected(autoSyncNotificationsEnabled ?? false, notificationsSource);
  const autoSyncIdentifier = usePredictedAutoSyncIdentifier(
    autoSyncSelected,
    notificationsDatasourceUID,
    notificationsDatasourceName
  );
  const createdTreeName = autoSyncSelected ? (autoSyncIdentifier ?? '') : policyTreeName;

  const { someRulesAreSkipped, rulesThatMightBeOverwritten } = useRulesToImport({
    rulesSource,
    rulesDatasourceName,
    rulesYamlFile,
    namespace,
    ruleGroup,
    targetFolder,
  });

  const { trees: existingTrees, isLoading: isLoadingRoutingTrees } = useRoutingTrees();
  const existingTreeOptions = useMemo(() => buildRoutingTreeOptions(existingTrees), [existingTrees]);

  const routingTreeOptions = useMemo(
    () => getRoutingTreeOptions(existingTreeOptions, createdTreeName, step1Completed),
    [existingTreeOptions, createdTreeName, step1Completed]
  );

  const handlePolicyTreeChange = (option: ComboboxOption<string> | null) => {
    setValue('selectedRoutingTree', option?.value ?? 'default');
  };

  const handleTargetFolderChange = (uid: string | undefined, title: string | undefined) => {
    setValue('targetFolder', uid && title ? { uid, title } : undefined);
  };

  return (
    <Stack direction="column" gap={3}>
      {/* Permission warning */}
      {!canImport && (
        <Alert
          severity="warning"
          title={t('alerting.import-to-gma.step2.no-permission-title', 'Insufficient permissions')}
        >
          <Trans i18nKey="alerting.import-to-gma.step2.no-permission-desc">
            You do not have permission to import alert rules. You need both <strong>alerting.rules:create</strong> and{' '}
            <strong>alerting.provisioning:write</strong> permissions. You can skip this step.
          </Trans>
        </Alert>
      )}

      {/* Notification Routing Card */}
      <Box backgroundColor="secondary" borderRadius="default" borderColor="weak" borderStyle="solid">
        <Box padding={2}>
          <Stack direction="column" gap={0.5}>
            <Text variant="h5" element="h3">
              {t('alerting.import-to-gma.step2.policy-title', 'Notification routing')}
            </Text>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="alerting.import-to-gma.step2.policy-desc">
                Choose how imported alerts should be routed to contact points.
              </Trans>
            </Text>
          </Stack>
        </Box>
        <Divider spacing={0} />
        <Box padding={2}>
          <Box>
            <Field
              label={t('alerting.import-to-gma.step2.policy-tree', 'Policy tree')}
              description={t(
                'alerting.import-to-gma.step2.policy-tree-desc',
                'Select a notification policy tree to route the imported alerts'
              )}
              noMargin
            >
              <Controller
                render={({ field: { onChange, ref, ...field } }) => (
                  <Combobox
                    {...field}
                    onChange={handlePolicyTreeChange}
                    options={routingTreeOptions}
                    placeholder={t('alerting.import-to-gma.step2.select-policy', 'Select a policy tree')}
                    loading={isLoadingRoutingTrees}
                    width={50}
                    data-testid={selectors.pages.Alerting.ImportToGMA.policyTreeInput}
                  />
                )}
                control={control}
                name="selectedRoutingTree"
              />
            </Field>
          </Box>
        </Box>
      </Box>

      <ImportSourceCard recordingTargets={recordingTargets} />

      {/* Additional Settings Card */}
      <Box backgroundColor="secondary" borderRadius="default" borderColor="weak" borderStyle="solid">
        <Box display="flex" alignItems="center" justifyContent="space-between" padding={2}>
          <Text variant="h5" element="h3">
            {t('alerting.import-to-gma.step2.settings-title', 'Additional settings')}
          </Text>
        </Box>
        <Divider spacing={0} />
        <Box padding={2}>
          <Stack direction="column" gap={2}>
            <Field
              label={t('alerting.import-to-gma.step2.target-folder', 'Target folder')}
              description={t(
                'alerting.import-to-gma.step2.target-folder-desc',
                'Folder where imported rules will be stored'
              )}
              noMargin
            >
              <Stack direction="row" gap={1} alignItems="center">
                <Controller
                  name="targetFolder"
                  control={control}
                  render={({ field: { ref, value, onChange, ...field } }) => (
                    <ProvisioningAwareFolderPicker {...field} value={value?.uid} onChange={handleTargetFolderChange} />
                  )}
                />
                <CreateNewFolder onCreate={(folder) => setValue('targetFolder', folder)} />
              </Stack>
            </Field>

            {/* Target data source for recording rules */}
            <Field
              required
              label={t('alerting.import-to-gma.step2.target-datasource', 'Target data source')}
              description={t(
                'alerting.import-to-gma.step2.target-datasource-desc',
                'The Prometheus data source to store recording rules in'
              )}
              invalid={Boolean(errors.targetDatasourceUID || recordingTargets.error)}
              error={
                errors.targetDatasourceUID?.message ??
                (recordingTargets.error &&
                  t(
                    'alerting.recording-rules.target-data-sources-error',
                    'Failed to load the list of data sources that can store recording rules'
                  ))
              }
              noMargin
            >
              <Controller
                render={({ field: { ref, onChange, ...field } }) => (
                  <DataSourcePicker
                    {...field}
                    current={field.value}
                    inputId="recording-rules-target-data-source"
                    noDefault
                    disabled={recordingTargets.isLoading}
                    isLoading={recordingTargets.isLoading}
                    filter={(ds) => recordingTargets.byUid.has(ds.uid)}
                    onChange={(ds) => setValue('targetDatasourceUID', ds.uid)}
                  />
                )}
                name="targetDatasourceUID"
                control={control}
                rules={{
                  required: {
                    value: true,
                    message: t(
                      'alerting.import-to-gma.step2.target-datasource-required',
                      'Please select a target data source'
                    ),
                  },
                }}
              />
            </Field>

            <Box marginTop={1}>
              <InlineField
                transparent
                label={t('alerting.import-to-gma.step2.pause-alerting', 'Pause imported alert rules')}
                labelWidth={30}
              >
                <InlineSwitch transparent id="pause-alerting-rules" {...register('pauseAlertingRules')} />
              </InlineField>

              <InlineField
                transparent
                label={t('alerting.import-to-gma.step2.pause-recording', 'Pause imported recording rules')}
                labelWidth={30}
              >
                <InlineSwitch transparent id="pause-recording-rules" {...register('pauseRecordingRules')} />
              </InlineField>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Skipped rules info */}
      {someRulesAreSkipped && (
        <Alert
          title={t('alerting.import-to-gma.step2.plugin-rules-warning-title', 'Some rules are excluded from import')}
          severity="info"
        >
          <Trans i18nKey="alerting.import-to-gma.step2.plugin-rules-warning-body">
            Rules managed by plugins, integrations, or Synthetic Monitoring have been detected and will not be imported.
          </Trans>
        </Alert>
      )}

      {/* Override Warning */}
      {!isEmpty(rulesThatMightBeOverwritten) && (
        <OverrideWarning rulesThatMightBeOverwritten={rulesThatMightBeOverwritten} />
      )}
    </Stack>
  );
}

function OverrideWarning({ rulesThatMightBeOverwritten }: { rulesThatMightBeOverwritten: RulerRulesConfigDTO }) {
  const [showDetails, toggleShowDetails] = useToggle(false);

  return (
    <Alert
      title={t('alerting.import-to-gma.step2.override-warning-title', 'Some existing rules may be overwritten')}
      severity="warning"
    >
      <Stack direction="column" gap={1}>
        <Text variant="body">
          <Trans i18nKey="alerting.import-to-gma.step2.override-warning-body">
            The target folder already contains alert rules that share the same namespace as the rules being imported.
            These existing rules may be overwritten or removed during the import.
          </Trans>
        </Text>
        <Collapse
          label={t('alerting.import-to-gma.step2.override-warning-details', 'Rules that might be overwritten')}
          isOpen={showDetails}
          onToggle={toggleShowDetails}
        >
          <CodeMirrorEditor
            height="300px"
            language="json"
            value={JSON.stringify(rulesThatMightBeOverwritten, null, 2)}
            onChange={noop}
            readOnly
            aria-label={t('alerting.import-to-gma.step2.override-warning-details', 'Rules that might be overwritten')}
          />
        </Collapse>
      </Stack>
    </Alert>
  );
}

/**
 * Hook to check if Step 2 form is valid.
 * Checks both that required fields are filled AND that there are no validation errors.
 */
export function useStep2Validation(canImport: boolean): boolean {
  const {
    watch,
    getValues,
    formState: { errors },
  } = useFormContext<ImportFormValues>();
  watch(RULES_JOB_FIELDS);
  const job = buildRulesImportJob(getValues());

  const hasStep2Errors =
    !!errors.rulesSource ||
    (job?.type === 'datasource' && !!errors.rulesDatasourceUID) ||
    (job?.type === 'yaml' && (!!errors.rulesYamlFile || !!errors.yamlImportTargetDatasourceUID)) ||
    !!errors.selectedRoutingTree ||
    !!errors.targetDatasourceUID;

  if (!canImport || hasStep2Errors) {
    return false;
  }

  return isStep2Valid(job);
}
