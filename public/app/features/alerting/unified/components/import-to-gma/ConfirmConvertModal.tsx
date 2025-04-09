import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { ComponentProps } from 'react';
import { useFormContext } from 'react-hook-form';

import { locationService } from '@grafana/runtime';
import { Alert, CodeEditor, ConfirmModal, Modal, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans, t } from 'app/core/internationalization';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { trackImportToGMAError, trackImportToGMASuccess } from '../../Analytics';
import { convertToGMAApi } from '../../api/convertToGMAApi';
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
  const { rulerRules } = useGetRulerRules(selectedDatasourceName || undefined);
  const [convert] = convertToGMAApi.useConvertToGMAMutation();
  const notifyApp = useAppNotification();
  const { filteredConfig: rulerRulesToPayload, someRulesAreSkipped } = filterRulerRulesConfig(
    rulerRules,
    namespace,
    ruleGroup
  );

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
  const confirmText = t('alerting.import-to-gma.confirm-modal.confirm', 'Yes, import');
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      confirmText={confirmText}
      confirmButtonVariant="primary"
      modalClass={styles.modal}
      body={
        <Stack direction="column" gap={2}>
          <Alert title={t('alerting.to-gma.confirm-modal.title-warning', 'Warning')} severity="warning">
            <Text variant="body">
              <Trans i18nKey="alerting.to-gma.confirm-modal.body">
                If the target folder is not empty, some rules may be overwritten or removed. Are you sure you want to
                import these alert rules to Grafana-managed rules?
              </Trans>
            </Text>
          </Alert>
          {someRulesAreSkipped && <AlertSomeRulesSkipped />}
          <Text variant="h6">
            <Trans i18nKey="alerting.to-gma.confirm-modal.summary">
              These are the list of rules that will be imported:
            </Trans>
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
