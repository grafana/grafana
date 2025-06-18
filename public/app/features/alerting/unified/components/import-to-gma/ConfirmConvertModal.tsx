import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { ComponentProps, useMemo } from 'react';
import { useAsync, useToggle } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, CodeEditor, Collapse, ConfirmModal, Modal, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { RulerRuleDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { trackImportToGMAError, trackImportToGMASuccess } from '../../Analytics';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { createListFilterLink } from '../../utils/navigation';
import { getRuleName, isPluginProvidedRule } from '../../utils/rules';

import { ImportFormValues } from './ImportToGMARules';
import { useGetRulesThatMightBeOverwritten, useGetRulesToBeImported } from './hooks';
import { parseYamlFileToRulerRulesConfigDTO } from './yamlToRulerConverter';

export const SYNTHETICS_RULE_NAMES = [
  'SyntheticMonitoringCheckFailureAtHighSensitivity',
  'SyntheticMonitoringCheckFailureAtMediumSensitivity',
  'SyntheticMonitoringCheckFailureAtLowSensitivity',
  'instance_job_severity:probe_success:mean5m',
];

type ModalProps = Pick<ComponentProps<typeof ConfirmModal>, 'isOpen' | 'onDismiss'> & {
  isOpen: boolean;
  importPayload: ImportFormValues;
};

const AlertSomeRulesSkipped = () => {
  return (
    <Alert
      title={t(
        'alerting.import-to-gma.confirm-modal.plugin-rules-warning.title',
        'Some rules are excluded from import'
      )}
      severity="info"
    >
      <Text variant="body">
        <Trans i18nKey="alerting.import-to-gma.confirm-modal.plugin-rules-warning.text">
          We have detected that some rules are managed by plugins. These rules will not be imported.
        </Trans>
      </Text>
    </Alert>
  );
};

const WarningForImportingRulesManagedByIntegrations = () => {
  return (
    <Alert
      title={t(
        'alerting.import-to-gma.confirm-modal.not-using-rules-managed-by-integrations-or-plugins.title',
        'Information'
      )}
      severity="info"
    >
      <Text variant="body">
        <Trans i18nKey="alerting.import-to-gma.confirm-modal.not-using-rules-managed-by-integrations-or-plugins.text">
          Rules managed by integrations or plugins should not be imported to Grafana-managed rules.
        </Trans>
      </Text>
    </Alert>
  );
};

const emptyObject = {};

export const ConfirmConversionModal = ({ importPayload, isOpen, onDismiss }: ModalProps) => {
  const appNotification = useAppNotification();
  const styles = useStyles2(getStyles);

  const {
    importSource,
    selectedDatasourceName,
    selectedDatasourceUID,
    yamlFile,
    targetFolder,
    namespace,
    ruleGroup,
    targetDatasourceUID,
    yamlImportTargetDatasourceUID,
    pauseRecordingRules,
    pauseAlertingRules,
  } = importPayload;

  // for datasource import, we need to fetch the rules from the datasource
  const dataSourceToFetch = isOpen && importSource === 'datasource' ? (selectedDatasourceName ?? '') : undefined;
  const { rulesToBeImported: rulesToBeImportedFromDatasource, isloadingCloudRules } = useGetRulesToBeImported(
    !isOpen || importSource === 'yaml',
    dataSourceToFetch
  );

  // for yaml import, we need to fetch the rules from the yaml file
  const { value: rulesToBeImportedFromYaml = emptyObject } = useAsync(async () => {
    if (!yamlFile || importSource !== 'yaml') {
      return emptyObject;
    }
    try {
      const rulerConfigFromYAML = await parseYamlFileToRulerRulesConfigDTO(yamlFile, yamlFile.name);
      return rulerConfigFromYAML;
    } catch (error) {
      appNotification.error(
        t('alerting.import-to-gma.yaml-error', 'Failed to parse YAML file: {{error}}', {
          error: stringifyErrorLike(error),
        })
      );
      return emptyObject;
    }
  }, [importSource, yamlFile]);

  // filter the rules to be imported from the datasource
  const { filteredConfig: rulerRulesToPayload, someRulesAreSkipped } = useMemo(() => {
    if (importSource === 'datasource') {
      return filterRulerRulesConfig(rulesToBeImportedFromDatasource, namespace, ruleGroup);
    }
    // for yaml, we don't filter the rules
    return {
      filteredConfig: rulesToBeImportedFromYaml,
      someRulesAreSkipped: false,
    };
  }, [namespace, ruleGroup, importSource, rulesToBeImportedFromYaml, rulesToBeImportedFromDatasource]);

  const { rulesThatMightBeOverwritten } = useGetRulesThatMightBeOverwritten(!isOpen, targetFolder, rulerRulesToPayload);

  const [convert] = convertToGMAApi.useConvertToGMAMutation();
  const notifyApp = useAppNotification();

  if (isloadingCloudRules) {
    return (
      <Modal
        isOpen={isOpen}
        title={t('alerting.import-to-gma.confirm-modal.loading', 'Loading...')}
        onDismiss={onDismiss}
        onClickBackdrop={onDismiss}
      >
        <Text>
          {t(
            'alerting.import-to-gma.confirm-modal.loading-body',
            'Preparing data to be imported. This can take a while...'
          )}
        </Text>
      </Modal>
    );
  }

  async function onConvertConfirm() {
    if (!yamlImportTargetDatasourceUID && !selectedDatasourceUID) {
      notifyApp.error(
        t('alerting.import-to-gma.error', 'Failed to import alert rules: {{error}}', {
          error: 'No data source selected',
        })
      );
      return;
    }
    try {
      await convert({
        dataSourceUID: importSource === 'yaml' ? (yamlImportTargetDatasourceUID ?? '') : (selectedDatasourceUID ?? ''),
        targetFolderUID: targetFolder?.uid,
        pauseRecordingRules: pauseRecordingRules,
        pauseAlerts: pauseAlertingRules,
        payload: rulerRulesToPayload,
        targetDatasourceUID,
      }).unwrap();

      const isRootFolder = isEmpty(targetFolder?.uid);

      trackImportToGMASuccess({
        importSource,
        isRootFolder,
        namespace,
        ruleGroup,
        pauseRecordingRules,
        pauseAlertingRules,
      });
      const ruleListUrl = createListFilterLink(isRootFolder ? [] : [['namespace', targetFolder?.title ?? '']], {
        skipSubPath: true,
      });
      notifyApp.success(
        t('alerting.import-to-gma.success', 'Successfully imported alert rules to Grafana-managed rules.')
      );
      locationService.push(ruleListUrl);
    } catch (error) {
      trackImportToGMAError({ importSource });
      notifyApp.error(
        t('alerting.import-to-gma.error', 'Failed to import alert rules: {{error}}', {
          error: stringifyErrorLike(error),
        })
      );
    }
  }

  const noRulesToImport = isEmpty(rulerRulesToPayload);
  if (noRulesToImport) {
    return (
      <Modal
        isOpen={isOpen}
        title={t('alerting.import-to-gma.confirm-modal.no-rules-title', 'No rules to import')}
        onDismiss={onDismiss}
        onClickBackdrop={onDismiss}
      >
        <Stack direction="column" gap={2}>
          {someRulesAreSkipped && <AlertSomeRulesSkipped />}
          <Text>
            {importSource === 'yaml'
              ? t(
                  'alerting.import-to-gma.confirm-modal.no-rules-body-yaml',
                  'There are no rules to import. Please select a different yaml file.'
                )
              : t(
                  'alerting.import-to-gma.confirm-modal.no-rules-body',
                  'There are no rules to import. Please select a different namespace or rule group.'
                )}
          </Text>
        </Stack>
      </Modal>
    );
  }

  // translations for texts in the modal
  const title = t('alerting.import-to-gma.confirm-modal.title', 'Confirm import');
  const confirmText = t('alerting.import-to-gma.confirm-modal.confirm', 'Import');
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      confirmText={confirmText}
      confirmButtonVariant="primary"
      modalClass={styles.modal}
      body={
        <Stack direction="column" gap={2}>
          {!isEmpty(rulesThatMightBeOverwritten) && (
            <TargetFolderNotEmptyWarning targetFolderRules={rulesThatMightBeOverwritten} />
          )}
          <WarningForImportingRulesManagedByIntegrations />
          {someRulesAreSkipped && <AlertSomeRulesSkipped />}
          <Text variant="h6">
            <Trans i18nKey="alerting.to-gma.confirm-modal.summary">The following alert rules will be imported:</Trans>
          </Text>
          {rulerRulesToPayload && <RulesPreview rules={rulerRulesToPayload} />}
        </Stack>
      }
      onConfirm={onConvertConfirm}
      onDismiss={onDismiss}
    />
  );
};

/**
 * Filter the ruler rules config to be imported. It filters the rules by namespace and group name.
 * It also filters out the rules that are managed by integrations or plugins.
 * Precondition: these rules are cloud rules.
 * @param rulerRulesConfig - The ruler rules config to be imported
 * @param namespace - The namespace to filter the rules by
 * @param groupName - The group name to filter the rules by
 * @returns The filtered ruler rules config and if some rules are skipped
 */
export function filterRulerRulesConfig(
  rulerRulesConfig: RulerRulesConfigDTO,
  namespace?: string,
  groupName?: string
): { filteredConfig: RulerRulesConfigDTO; someRulesAreSkipped: boolean } {
  const filteredConfig: RulerRulesConfigDTO = {};
  let someRulesAreSkipped = false;

  Object.entries(rulerRulesConfig).forEach(([ns, groups]) => {
    if (namespace && ns !== namespace) {
      return;
    }

    const filteredGroups = groups
      .filter((group) => {
        if (groupName && group.name !== groupName) {
          return false;
        }
        return true;
      })
      .map((group) => {
        const filteredRules = group.rules.filter((rule) => {
          const shouldSkip = isRuleManagedByExternalSystem(rule);
          if (shouldSkip) {
            someRulesAreSkipped = true;
            return false;
          }
          return true;
        });

        return {
          ...group,
          rules: filteredRules,
        };
      })
      .filter((group) => group.rules.length > 0);

    if (filteredGroups.length > 0) {
      filteredConfig[ns] = filteredGroups;
    }
  });

  return { filteredConfig, someRulesAreSkipped };
}

/*
This function is used to check if the rule is managed by external system.
It checks if the rule has the '__grafana_origin' label, and if the rule is from synthetics.
These are the conditions for a rule to be managed by external system:
- If the rule has the '__grafana_origin' label
- If the rule is from synthetics
- If the rule is from integrations
*/
function isRuleManagedByExternalSystem(rule: RulerRuleDTO): boolean {
  // check if the rule has the '__grafana_origin' label
  const hasGrafanaOriginLabel = isPluginProvidedRule(rule);
  if (hasGrafanaOriginLabel) {
    return true;
  }
  // check if the rule is from intergrations by checking if the namespace starts with 'integrations-'
  const isIntegration = rule.labels?.namespace?.startsWith('integrations-');
  if (isIntegration) {
    return true;
  }
  // check if the rule is from synthetics by checking if the namespace is 'synthetic_monitoring'
  const hasSyntheticsLabels = rule.labels?.namespace === 'synthetic_monitoring';

  if (!hasSyntheticsLabels) {
    return false;
  }

  const ruleName = getRuleName(rule);

  return SYNTHETICS_RULE_NAMES.some((name) => name === ruleName);
}

function RulesPreview({ rules }: { rules: RulerRulesConfigDTO }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.content}>
      <CodeEditor
        width="100%"
        height={500}
        language={'json'}
        value={JSON.stringify(rules, null, 4)}
        monacoOptions={{
          minimap: {
            enabled: false,
          },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          readOnly: true,
        }}
      />
    </div>
  );
}

const getStyles = () => ({
  content: css({
    flex: '1 1 100%',
  }),
  modal: css({
    width: '800px',
  }),
});

function TargetFolderNotEmptyWarning({ targetFolderRules }: { targetFolderRules: RulerRulesConfigDTO }) {
  const [showTargetRules, toggleShowTargetRules] = useToggle(false);
  return (
    <Stack direction="column" gap={2}>
      <Alert title={t('alerting.to-gma.confirm-modal.title-warning', 'Warning')} severity="warning">
        <Text variant="body">
          <Trans i18nKey="alerting.to-gma.confirm-modal.body">
            The target folder is not empty, some rules may be overwritten or removed. Are you sure you want to import
            these alert rules to Grafana-managed rules?
          </Trans>
        </Text>
      </Alert>
      {targetFolderRules && (
        <Collapse
          label={t(
            'alerting.import-to-gma.confirm-modal.target-folder-rules',
            'Target folder rules that might be overwritten'
          )}
          isOpen={showTargetRules}
          onToggle={toggleShowTargetRules}
          collapsible={true}
        >
          <RulesPreview rules={targetFolderRules} />
        </Collapse>
      )}
    </Stack>
  );
}
