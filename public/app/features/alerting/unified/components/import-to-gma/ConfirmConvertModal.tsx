import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { ComponentProps, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv, locationService } from '@grafana/runtime';
import { Alert, CodeEditor, Collapse, ConfirmModal, Modal, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans, t } from 'app/core/internationalization';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { FolderDTO } from 'app/types';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { trackImportToGMAError, trackImportToGMASuccess } from '../../Analytics';
import { alertRuleApi } from '../../api/alertRuleApi';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import { Folder } from '../../types/rule-form';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';
import { createListFilterLink } from '../../utils/navigation';
import { useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';

import { ImportFormValues } from './ImportFromDSRules';

type ModalProps = Pick<ComponentProps<typeof ConfirmModal>, 'isOpen' | 'onDismiss'> & {
  isOpen: boolean;
};

const AlertSomeRulesSkipped = () => (
  <Alert
    title={t('alerting.import-to-gma.confirm-modal.plugin-rules-warning.title', 'Some rules are excluded from import')}
    severity="info"
  >
    <Text variant="body">
      <Trans i18nKey="alerting.import-to-gma.confirm-modal.plugin-rules-warning.text">
        We have detected that some rules are managed by plugins. These rules will not be imported.
      </Trans>
    </Text>
  </Alert>
);

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
  ] = watch([
    'targetFolder',
    'selectedDatasourceName',
    'selectedDatasourceUID',
    'pauseRecordingRules',
    'pauseAlertingRules',
    'namespace',
    'ruleGroup',
    'targetDatasourceUID',
  ]);

  const dataSourceToFetch = isOpen ? (selectedDatasourceName ?? '') : undefined;
  const { rulesToBeImported, isloadingCloudRules } = useGetRulesToBeImported(!isOpen, dataSourceToFetch);
  const { filteredConfig: rulerRulesToPayload, someRulesAreSkipped } = useMemo(
    () => filterRulerRulesConfig(rulesToBeImported, namespace, ruleGroup),
    [rulesToBeImported, namespace, ruleGroup]
  );
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
            'Preparing data to be imported.This can take a while...'
          )}
        </Text>
      </Modal>
    );
  }

  async function onConvertConfirm() {
    try {
      await convert({
        dataSourceUID: selectedDatasourceUID,
        targetFolderUID: targetFolder?.uid,
        pauseRecordingRules: pauseRecordingRules,
        pauseAlerts: pauseAlertingRules,
        payload: rulerRulesToPayload,
        targetDatasourceUID,
      }).unwrap();

      const isRootFolder = isEmpty(targetFolder?.uid);

      trackImportToGMASuccess();
      const ruleListUrl = createListFilterLink(isRootFolder ? [] : [['namespace', targetFolder?.title ?? '']], {
        skipSubPath: true,
      });
      notifyApp.success(
        t('alerting.import-to-gma.success', 'Successfully imported alert rules to Grafana-managed rules.')
      );
      locationService.push(ruleListUrl);
    } catch (error) {
      trackImportToGMAError();
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
            {t(
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
            <Trans i18nKey="alerting.to-gma.confirm-modal.summary">The following alert rules will be imported::</Trans>
          </Text>
          {rulerRulesToPayload && <RulesPreview rules={rulerRulesToPayload} />}
        </Stack>
      }
      onConfirm={onConvertConfirm}
      onDismiss={onDismiss}
    />
  );
};

function filterRulerRulesConfig(
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

    const filteredGroups = groups.filter((group) => {
      if (groupName && group.name !== groupName) {
        return false;
      }

      // Filter out rules that have the GRAFANA_ORIGIN_LABEL
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
    });

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

function useFilterRulesThatMightBeOverwritten(
  targetNestedFolders: FolderDTO[],
  rulesToBeImported: RulerRulesConfigDTO,
  skip = true
): RulerRulesConfigDTO {
  const [fetchRulesByFolderUID] = alertRuleApi.endpoints.rulerNamespace.useLazyQuery();
  const [rulesThatMightBeOverwritten, setRulesThatMightBeOverwritten] = useState<RulerRulesConfigDTO>({});

  useEffect(() => {
    if (skip || isEmpty(targetNestedFolders) || isEmpty(rulesToBeImported)) {
      setRulesThatMightBeOverwritten({});
      return;
    }
    // filter targetNestedFolders to only include folders that are in the rulesToBeImported
    const targetNestedFoldersFiltered = targetNestedFolders.filter((folder) => {
      return Object.keys(rulesToBeImported).includes(folder.title);
    });
    const fetchRules = async () => {
      const results: RulerRulesConfigDTO = {};

      await Promise.all(
        targetNestedFoldersFiltered.map(async (folder) => {
          const { data: rules } = await fetchRulesByFolderUID({
            namespace: folder.uid,
            rulerConfig: GRAFANA_RULER_CONFIG,
          });

          if (rules) {
            const folderWithParentTitle = Object.keys(rules)[0];
            results[folderWithParentTitle] = rules[folderWithParentTitle] || [];
          }
        })
      );

      setRulesThatMightBeOverwritten(results);
    };

    fetchRules();
  }, [targetNestedFolders, rulesToBeImported, skip, fetchRulesByFolderUID]);

  return rulesThatMightBeOverwritten;
}

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

async function getNestedFoldersIn(uid: string) {
  const response = await lastValueFrom(
    getBackendSrv().fetch<FolderDTO[]>({
      url: `/api/folders`,
      params: { parentUid: uid },
      method: 'GET',
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );

  return response?.data;
}

export function useGetNestedFolders(folderUID: string, skip = false) {
  const [nestedFolders, setNestedFolders] = useState<FolderDTO[]>([]);

  useEffect(() => {
    (async () => {
      const nestedFoldersIn = skip ? [] : await getNestedFoldersIn(folderUID);
      setNestedFolders(nestedFoldersIn);
    })();
  }, [folderUID, skip]);

  return nestedFolders;
}

function useGetRulesThatMightBeOverwritten(
  skip: boolean,
  targetFolder: Folder | undefined,
  rulesToBeImported: RulerRulesConfigDTO
) {
  // get nested folders in the target folder
  const nestedFoldersInTargetFolder = useGetNestedFolders(targetFolder?.uid || '', skip);
  const skipFiltering = skip || nestedFoldersInTargetFolder.length === 0;
  const rulesThatMightBeOverwritten = useFilterRulesThatMightBeOverwritten(
    nestedFoldersInTargetFolder,
    rulesToBeImported,
    skipFiltering
  );

  return { rulesThatMightBeOverwritten };
}

function useGetRulesToBeImported(skip: boolean, selectedDatasourceName: string | undefined) {
  // we need to skip fetching and filtering if the modal is not open
  const dataSourceToFetch = !skip ? selectedDatasourceName : undefined;
  const { rulerRules: rulesToBeImported, isLoading: isloadingCloudRules } = useGetRulerRules(dataSourceToFetch);

  return { rulesToBeImported, isloadingCloudRules };
}
