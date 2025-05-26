import { css } from '@emotion/css';
import { load } from 'js-yaml';
import { isEmpty } from 'lodash';
import { ComponentProps, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { useAsync, useToggle } from 'react-use';

import { Trans, useTranslate } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, CodeEditor, Collapse, ConfirmModal, Modal, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { trackImportToGMAError, trackImportToGMASuccess } from '../../Analytics';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';
import { createListFilterLink } from '../../utils/navigation';

import { ImportFormValues } from './ImportToGMARules';
import { useGetRulesThatMightBeOverwritten, useGetRulesToBeImported } from './hooks';

type ModalProps = Pick<ComponentProps<typeof ConfirmModal>, 'isOpen' | 'onDismiss'> & {
  isOpen: boolean;
};

const AlertSomeRulesSkipped = () => {
  const { t } = useTranslate();

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

export const ConfirmConversionModal = ({ isOpen, onDismiss }: ModalProps) => {
  const { watch } = useFormContext<ImportFormValues>();
  const styles = useStyles2(getStyles);

  const [
    targetFolder,
    selectedDatasourceName,
    selectedDatasourceUID,
    pauseRecordingRules,
    pauseAlertingRules,
    namespace,
    ruleGroup,
    targetDatasourceUID,
    yamlFile,
    importSource,
    yamlImportTargetDatasourceUID,
  ] = watch([
    'targetFolder',
    'selectedDatasourceName',
    'selectedDatasourceUID',
    'pauseRecordingRules',
    'pauseAlertingRules',
    'namespace',
    'ruleGroup',
    'targetDatasourceUID',
    'yamlFile',
    'importSource',
    'yamlImportTargetDatasourceUID',
  ]);

  // for datasource import, we need to fetch the rules from the datasource
  const dataSourceToFetch = (isOpen && importSource === 'datasource') ? (selectedDatasourceName ?? '') : undefined;
  const { rulesToBeImported: rulesToBeImportedFromDatasource, isloadingCloudRules } = useGetRulesToBeImported(!isOpen || importSource === 'yaml', dataSourceToFetch);

  // for yaml import, we need to fetch the rules from the yaml file
  const { value: rulesToBeImportedFromYaml = {} } = useAsync(async () => {
    if (!yamlFile || importSource !== 'yaml') {
      return {};
    }
    try {
      const rulerConfigFromYAML = parseYamlToRulerRulesConfigDTO(await yamlFile.text(), yamlFile.name);
      return rulerConfigFromYAML;

    } catch (error) {
      console.error('Error parsing YAML file:', error);
      return {};
    }
  }, [importSource, yamlFile]);

  // filter the rules to be imported from the datasource 
  const { filteredConfig: rulerRulesToPayload, someRulesAreSkipped } = useMemo(
    () => {
      if (importSource === 'datasource') {
        return filterRulerRulesConfig(rulesToBeImportedFromDatasource, namespace, ruleGroup);
      }
      // for yaml, we dont filter the rules
      return ({
        filteredConfig: rulesToBeImportedFromYaml,
        someRulesAreSkipped: false
      })
    },
    [rulesToBeImportedFromDatasource, namespace, ruleGroup, importSource, rulesToBeImportedFromYaml]

  );
  const { rulesThatMightBeOverwritten } = useGetRulesThatMightBeOverwritten(!isOpen, targetFolder, rulerRulesToPayload);

  const [convert] = convertToGMAApi.useConvertToGMAMutation();
  const notifyApp = useAppNotification();
  const { t } = useTranslate();
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
            'Preparing data to be imported.This can take a while...'
          )}
        </Text>
      </Modal>
    );
  }

  async function onConvertConfirm() {
    if (!yamlImportTargetDatasourceUID && !selectedDatasourceUID) {
      notifyApp.error(t('alerting.import-to-gma.error', 'Failed to import alert rules: {{error}}', {
        error: 'No data source selected',
      }));
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

      trackImportToGMASuccess({ importSource });
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
            {importSource === 'yaml' ? t(
              'alerting.import-to-gma.confirm-modal.no-rules-body-yaml',
              'There are no rules to import. Please select a different yaml file.'
            ) : t(
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

interface Group {
  name: string;
  rules: Rule[];
}

interface Rule {
  alert: string;
  expr: string;
  for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

function isValidString(value: unknown): value is string {
  return typeof value === 'string';
}

function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && Boolean(value);
}

function hasRequiredProperties(obj: Record<string, unknown>, properties: string[]): boolean {
  return properties.every(prop => prop in obj);
}

function isRule(obj: unknown): obj is Rule {
  if (!isValidObject(obj)) {
    return false;
  }

  const requiredProps = ['alert', 'expr'];
  if (!hasRequiredProperties(obj, requiredProps)) {
    return false;
  }

  const rule = obj as unknown as Rule;
  if (!isValidString(rule.alert) || !isValidString(rule.expr)) {
    return false;
  }

  // Check optional properties if they exist
  if ('for' in rule && !isValidString(rule.for)) {
    return false;
  }

  if ('labels' in rule && !isValidObject(rule.labels)) {
    return false;
  }

  if ('annotations' in rule && !isValidObject(rule.annotations)) {
    return false;
  }

  return true;
}

function isGroup(obj: unknown): obj is Group {
  if (!isValidObject(obj)) {
    return false;
  }

  const requiredProps = ['name', 'rules'];
  if (!hasRequiredProperties(obj, requiredProps)) {
    return false;
  }

  const group = obj as unknown as Group;
  if (!isValidString(group.name) || !Array.isArray(group.rules)) {
    return false;
  }

  return group.rules.every(isRule);
}

export function parseYamlToRulerRulesConfigDTO(yamlAsString: string, defaultNamespace: string): RulerRulesConfigDTO {

  const obj = load(yamlAsString);
  if (!obj || typeof obj !== 'object' || !('groups' in obj) || !Array.isArray((obj as { groups: unknown[] }).groups)) {
    throw new Error('Invalid YAML format: missing or invalid groups array');
  }

  const namespace = 'namespace' in obj && isValidString(obj.namespace) ? obj.namespace : defaultNamespace;

  const data: RulerRulesConfigDTO = {};
  data[namespace] = (obj as { groups: unknown[] }).groups.map((group: unknown) => {
    if (!isGroup(group)) {
      throw new Error('Invalid group format: missing name or rules array');
    }

    return {
      name: group.name,
      rules: group.rules.map((rule: unknown) => {
        if (!isRule(rule)) {
          throw new Error('Invalid rule format: missing alert or expr');
        }

        return {
          alert: rule.alert,
          expr: rule.expr,
          for: rule.for,
          labels: rule.labels,
          annotations: rule.annotations
        };
      })
    };
  });

  return data;
}
/**
 * Filter the ruler rules config to be imported. It filters the rules by namespace and group name.
 * It also filters out the rules that have the '__grafana_origin' label.
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
          const hasGrafanaOriginLabel = rule.labels?.[GRAFANA_ORIGIN_LABEL];
          if (hasGrafanaOriginLabel) {
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
  const { t } = useTranslate();

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
