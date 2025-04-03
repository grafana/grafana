import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { ComponentProps } from 'react';
import { useFormContext } from 'react-hook-form';

import { locationService } from '@grafana/runtime';
import { CodeEditor, ConfirmModal, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans, t } from 'app/core/internationalization';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { trackImportToGMAError, trackImportToGMASuccess } from '../../Analytics';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { createListFilterLink } from '../../utils/navigation';
import { useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';

import { ImportFormValues } from './ImportFromDSRules';

type ModalProps = Pick<ComponentProps<typeof ConfirmModal>, 'isOpen' | 'onDismiss'> & {
  isOpen: boolean;
};

export const ConfirmConversionModal = ({ isOpen, onDismiss }: ModalProps) => {
  const { watch } = useFormContext<ImportFormValues>();

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
  const rulerRulesToPayload = filterRulerRulesConfig(rulerRules, namespace, ruleGroup);

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

  // translations for texts in the modal
  const title = t('alerting.import-to-gma.confirm-modal.title', 'Confirm import');
  const confirmText = t('alerting.import-to-gma.confirm-modal.confirm', 'Yes, import');
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      confirmText={confirmText}
      confirmButtonVariant="primary"
      body={
        <Stack direction="column" gap={2}>
          <Stack direction="row" gap={1} alignItems={'self-start'}>
            <Text color="warning">
              <Icon name="exclamation-triangle" />
            </Text>
            <Trans i18nKey="alerting.to-gma.confirm-modal.body">
              If the target folder is not empty, some rules may be overwritten or removed. Are you sure you want to
              import these alert rules to Grafana-managed rules?
            </Trans>
          </Stack>
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
): RulerRulesConfigDTO {
  const filteredConfig: RulerRulesConfigDTO = {};

  Object.entries(rulerRulesConfig).forEach(([ns, groups]) => {
    if (namespace && ns !== namespace) {
      return;
    }

    const filteredGroups = groups.filter((group) => {
      if (groupName && group.name !== groupName) {
        return false;
      }
      return true;
    });

    if (filteredGroups.length > 0) {
      filteredConfig[ns] = filteredGroups;
    }
  });

  return filteredConfig;
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
    width: '700px',
  }),
});
