import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  Alert,
  Box,
  Combobox,
  ComboboxOption,
  Field,
  FileUpload,
  InlineField,
  InlineSwitch,
  RadioButtonList,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { ProvisioningAwareFolderPicker } from 'app/features/provisioning/components/Shared/ProvisioningAwareFolderPicker';

import {
  DataSourceType,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
  isValidRecordingRulesTarget,
} from '../../../utils/datasource';
import { CreateNewFolder } from '../../create-folder/CreateNewFolder';
import { useGetNameSpacesByDatasourceName } from '../../rule-editor/useAlertRuleSuggestions';
import { ImportFormValues } from '../ImportToGMA';
import { getRulesSourceOptions } from '../Wizard/constants';
import { useRoutingTrees } from '../useRoutingTrees';

import { isStep2Valid } from './utils';

interface Step2ContentProps {
  step1Completed: boolean;
  step1Skipped: boolean;
  /** Whether the user has permission to import rules */
  canImport: boolean;
  /** Callback to report validation state changes */
  onValidationChange?: (isValid: boolean) => void;
}

const supportedImportTypes: string[] = [DataSourceType.Prometheus, DataSourceType.Loki];

/**
 * Step2Content - Content for the alert rules import step
 * This component contains only the form fields, without the header or action buttons
 * The WizardStep wrapper provides those
 */
export function Step2Content({ step1Completed, step1Skipped, canImport, onValidationChange }: Step2ContentProps) {
  const styles = useStyles2(getStyles);
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  const [
    rulesSource,
    rulesDatasourceUID,
    rulesDatasourceName,
    rulesYamlFile,
    selectedRoutingTree,
    policyTreeName,
    namespace,
    targetDatasourceUID,
  ] = watch([
    'rulesSource',
    'rulesDatasourceUID',
    'rulesDatasourceName',
    'rulesYamlFile',
    'selectedRoutingTree',
    'policyTreeName',
    'namespace',
    'targetDatasourceUID',
  ]);

  // Get namespaces and groups for filtering
  const { namespaceGroups, isLoading: isLoadingNamespaces } = useGetNameSpacesByDatasourceName(
    rulesSource === 'datasource' ? (rulesDatasourceName ?? undefined) : undefined
  );

  const namespaceOptions: Array<ComboboxOption<string>> = useMemo(
    () =>
      Array.from(namespaceGroups.keys()).map((ns) => ({
        label: ns,
        value: ns,
      })),
    [namespaceGroups]
  );

  const groupOptions: Array<ComboboxOption<string>> = useMemo(
    () => (namespace && namespaceGroups.get(namespace)?.map((group) => ({ label: group, value: group }))) || [],
    [namespace, namespaceGroups]
  );

  // Reset namespace/group if datasource changes
  useEffect(() => {
    setValue('namespace', undefined);
    setValue('ruleGroup', undefined);
  }, [rulesDatasourceName, setValue]);

  const isImportYamlEnabled = config.featureToggles.alertingImportYAMLUI ?? false;

  const rulesSourceOptions = getRulesSourceOptions(isImportYamlEnabled);

  // Fetch available routing trees from the k8s API
  const { routingTrees, isLoading: isLoadingRoutingTrees } = useRoutingTrees();

  // Build routing tree dropdown options
  // Only includes: routing trees from API + policyTreeName from Step 1 (if filled)
  const routingTreeOptions: Array<ComboboxOption<string>> = useMemo(() => {
    const options: Array<ComboboxOption<string>> = [];

    // Add the policy tree name from Step 1 if it was filled and Step 1 was completed
    // Put it first since it's the most relevant option
    const existingNames = routingTrees.map((rt) => rt.name);
    if (step1Completed && policyTreeName && !existingNames.includes(policyTreeName)) {
      options.push({
        label: policyTreeName,
        value: policyTreeName,
      });
    }

    // Add existing routing trees from the API
    routingTrees.forEach((rt) => {
      options.push({
        label: rt.label,
        value: rt.name,
      });
    });

    return options;
  }, [step1Completed, policyTreeName, routingTrees]);

  // Validation logic
  const isValid = useMemo(() => {
    return isStep2Valid({
      canImport,
      rulesSource,
      rulesYamlFile,
      rulesDatasourceUID,
      selectedRoutingTree,
      targetDatasourceUID,
    });
  }, [canImport, rulesSource, rulesYamlFile, rulesDatasourceUID, selectedRoutingTree, targetDatasourceUID]);

  // Report validation changes to parent
  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  return (
    <Stack direction="column" gap={3}>
      {step1Skipped && (
        <Alert severity="info" title={t('alerting.import-to-gma.step2.skipped-step1', 'Step 1 was skipped')}>
          <Trans i18nKey="alerting.import-to-gma.step2.skipped-step1-desc">
            You skipped importing Alertmanager resources. You can still import rules and route them using the default
            Grafana policy or a custom label.
          </Trans>
        </Alert>
      )}

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
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Text variant="h5" element="h3">
            {t('alerting.import-to-gma.step2.policy-title', 'Notification Routing')}
          </Text>
        </div>
        <div className={styles.cardContent}>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="alerting.import-to-gma.step2.policy-desc">
              Choose how imported alerts should be routed to contact points.
            </Trans>
          </Text>
          <Box marginTop={2}>
            <Field
              label={t('alerting.import-to-gma.step2.policy-tree', 'Policy tree')}
              description={t(
                'alerting.import-to-gma.step2.policy-tree-desc',
                'Select a notification policy tree to route alerts'
              )}
              noMargin
            >
              <Controller
                render={({ field: { onChange, ref, ...field } }) => (
                  <Combobox
                    {...field}
                    onChange={(option) => setValue('selectedRoutingTree', option?.value ?? 'default')}
                    options={routingTreeOptions}
                    placeholder={t('alerting.import-to-gma.step2.select-policy', 'Select a policy tree')}
                    loading={isLoadingRoutingTrees}
                    width={50}
                  />
                )}
                control={control}
                name="selectedRoutingTree"
              />
            </Field>
          </Box>
        </div>
      </div>

      {/* Import Source Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Text variant="h5" element="h3">
            {t('alerting.import-to-gma.step2.source-title', 'Import Source')}
          </Text>
        </div>
        <div className={styles.cardContent}>
          <Field noMargin>
            <Controller
              render={({ field: { onChange, ref, ...field } }) => (
                <RadioButtonList
                  {...field}
                  onChange={(value) => setValue('rulesSource', value)}
                  options={rulesSourceOptions}
                />
              )}
              control={control}
              name="rulesSource"
            />
          </Field>

          <Box marginTop={2}>
            {rulesSource === 'datasource' && (
              <Stack direction="column" gap={2}>
                <Field
                  label={t('alerting.import-to-gma.step2.datasource', 'Data source')}
                  invalid={!!errors.rulesDatasourceUID}
                  error={errors.rulesDatasourceUID?.message}
                  noMargin
                >
                  <Controller
                    render={({ field: { ref, onChange, ...field } }) => (
                      <DataSourcePicker
                        {...field}
                        alerting
                        filter={(ds: DataSourceInstanceSettings) =>
                          isSupportedExternalPrometheusFlavoredRulesSourceType(ds.type) &&
                          supportedImportTypes.includes(ds.type)
                        }
                        current={field.value}
                        onChange={(ds: DataSourceInstanceSettings) => {
                          onChange(ds.uid);
                          setValue('rulesDatasourceName', ds.name);
                        }}
                        noDefault
                        width={40}
                      />
                    )}
                    control={control}
                    name="rulesDatasourceUID"
                  />
                </Field>

                {/* Namespace and Group Filter */}
                {rulesDatasourceUID && (
                  <Stack direction="row" gap={2}>
                    <Field
                      label={t('alerting.import-to-gma.step2.namespace', 'Namespace')}
                      description={t('alerting.import-to-gma.step2.namespace-desc', 'Filter by namespace (optional)')}
                      noMargin
                    >
                      <Controller
                        render={({ field: { onChange, ref, ...field } }) => (
                          <Combobox
                            {...field}
                            onChange={(value) => {
                              setValue('ruleGroup', undefined);
                              onChange(value?.value);
                            }}
                            placeholder={t('alerting.import-to-gma.step2.select-namespace', 'All namespaces')}
                            options={namespaceOptions}
                            width={30}
                            loading={isLoadingNamespaces}
                            disabled={isLoadingNamespaces || !rulesDatasourceName}
                            isClearable
                          />
                        )}
                        name="namespace"
                        control={control}
                      />
                    </Field>
                    <Field
                      label={t('alerting.import-to-gma.step2.group', 'Group')}
                      description={t('alerting.import-to-gma.step2.group-desc', 'Filter by group (optional)')}
                      noMargin
                    >
                      <Controller
                        render={({ field: { ref, ...field } }) => (
                          <Combobox
                            {...field}
                            options={groupOptions}
                            width={30}
                            onChange={(value) => {
                              setValue('ruleGroup', value?.value);
                            }}
                            placeholder={t('alerting.import-to-gma.step2.select-group', 'All groups')}
                            loading={isLoadingNamespaces}
                            disabled={isLoadingNamespaces || !namespace || !rulesDatasourceName}
                            isClearable
                          />
                        )}
                        name="ruleGroup"
                        control={control}
                      />
                    </Field>
                  </Stack>
                )}
              </Stack>
            )}

            {rulesSource === 'yaml' && (
              <Field
                label={t('alerting.import-to-gma.step2.yaml-file', 'Rules YAML file')}
                invalid={!!errors.rulesYamlFile}
                error={errors.rulesYamlFile?.message}
                noMargin
              >
                <Controller
                  render={({ field: { ref, onChange, value, ...field } }) => (
                    <FileUpload
                      {...field}
                      accept=".yaml,.yml"
                      onFileUpload={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) {
                          onChange(file);
                        }
                      }}
                    >
                      {rulesYamlFile
                        ? rulesYamlFile.name
                        : t('alerting.import-to-gma.step2.upload', 'Upload YAML file')}
                    </FileUpload>
                  )}
                  control={control}
                  name="rulesYamlFile"
                />
              </Field>
            )}
          </Box>
        </div>
      </div>

      {/* Additional Settings Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Text variant="h5" element="h3">
            {t('alerting.import-to-gma.step2.settings-title', 'Additional Settings')}
          </Text>
        </div>
        <div className={styles.cardContent}>
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
                    <ProvisioningAwareFolderPicker
                      {...field}
                      value={value?.uid}
                      onChange={(uid: string | undefined, title: string | undefined) => {
                        if (uid && title) {
                          setValue('targetFolder', { uid, title });
                        } else {
                          setValue('targetFolder', undefined);
                        }
                      }}
                    />
                  )}
                />
                <CreateNewFolder
                  onCreate={(folder) => {
                    setValue('targetFolder', folder);
                  }}
                />
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
              invalid={!!errors.targetDatasourceUID}
              error={errors.targetDatasourceUID?.message}
              noMargin
            >
              <Controller
                render={({ field: { ref, onChange, ...field } }) => (
                  <DataSourcePicker
                    {...field}
                    current={field.value}
                    inputId="recording-rules-target-data-source"
                    noDefault
                    filter={isValidRecordingRulesTarget}
                    onChange={(ds: DataSourceInstanceSettings) => {
                      setValue('targetDatasourceUID', ds.uid);
                    }}
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
        </div>
      </div>
    </Stack>
  );
}

/**
 * Hook to check if Step 2 form is valid
 */
export function useStep2Validation(canImport: boolean): boolean {
  const { watch } = useFormContext<ImportFormValues>();
  const [rulesSource, rulesDatasourceUID, rulesYamlFile, selectedRoutingTree, targetDatasourceUID] = watch([
    'rulesSource',
    'rulesDatasourceUID',
    'rulesYamlFile',
    'selectedRoutingTree',
    'targetDatasourceUID',
  ]);

  return useMemo(() => {
    return isStep2Valid({
      canImport,
      rulesSource,
      rulesYamlFile,
      rulesDatasourceUID,
      selectedRoutingTree,
      targetDatasourceUID,
    });
  }, [canImport, rulesSource, rulesYamlFile, rulesDatasourceUID, selectedRoutingTree, targetDatasourceUID]);
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
  }),
  cardHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  cardContent: css({
    padding: theme.spacing(2),
  }),
});
