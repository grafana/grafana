import { css } from '@emotion/css';
import { ComponentProps } from 'react';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, CodeEditor, ConfirmModal, Stack, useStyles2 } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { getMessageFromError } from 'app/core/utils/errors';
import { useAsync } from 'app/features/alerting/unified/hooks/useAsync';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { useAddRuleToRuleGroup } from '../../../hooks/ruleGroup/useUpsertRuleFromRuleGroup';
import { RuleFormValues } from '../../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { stringifyErrorLike } from '../../../utils/misc';
import { grafanaRuleDtoToFormValues } from '../../../utils/rule-form';
import { rulerRuleType } from '../../../utils/rules';
import { createRelativeUrl } from '../../../utils/url';

type ModalProps = Pick<ComponentProps<typeof ConfirmModal>, 'isOpen' | 'onDismiss'> & {
  isOpen: boolean;
  ruleToRestore?: RulerGrafanaRuleDTO | undefined;
  onRestoreSucess: () => void;
  onRestoreError: (error: Error) => void;
};

export const ConfirmRestoreDeletedRuleModal = ({
  isOpen,
  ruleToRestore,
  onDismiss,
  onRestoreSucess,
  onRestoreError,
}: ModalProps) => {
  const [restoreMethod, { error }] = useRestoreDeletedRule();

  const title = t('alerting.deleted-rules.restore-modal.title', 'Restore deleted alert rule');
  const errorTitle = t('alerting.deleted-rules.restore-modal.error', 'Could not restore deleted alert rule');
  const confirmText = !error
    ? t('alerting.deleted-rules.restore-modal.confirm', 'Yes, restore deleted rule')
    : 'Manually restore the rule';

  const styles = useStyles2(getStyles);

  async function onRestoreConfirm() {
    if (!ruleToRestore) {
      return;
    }
    return restoreMethod
      .execute(ruleToRestore)
      .then(() => {
        onDismiss();
        onRestoreSucess();
      })
      .catch((err) => {
        onRestoreError(err);
      });
  }

  async function onManualRestore() {
    if (!ruleToRestore) {
      return;
    }
    await redirectToRestoreForm(ruleToRestore);
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      confirmText={confirmText}
      modalClass={styles.modal}
      confirmButtonVariant={!error ? 'destructive' : 'primary'}
      body={
        <Stack direction="column" gap={2}>
          <Trans i18nKey="alerting.deleted-rules.restore-modal.body">
            Are you sure you want to restore this deleted alert rule definition?
          </Trans>

          <div>{ruleToRestore && <RulePreview rule={ruleToRestore} />}</div>
          {error && (
            <Alert severity="warning" title={errorTitle}>
              <Trans i18nKey="alerting.deleted-rules.restore-deleted-manually">
                Your alert rule could not be restored. This may be due to changes to other entities such as contact
                points, data sources etc. Please manually restore the deleted rule by editing the rule and saving it.
              </Trans>
              <pre style={{ marginBottom: 0 }}>
                <code>{stringifyErrorLike(error)}</code>
              </pre>
            </Alert>
          )}
        </Stack>
      }
      onConfirm={!error ? onRestoreConfirm : onManualRestore}
      onDismiss={onDismiss}
    />
  );
};

function RulePreview({ rule }: { rule: RulerRuleDTO }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.content}>
      <CodeEditor
        width="100%"
        height={600}
        language={'json'}
        value={JSON.stringify(rule, null, 4)}
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

export function useRestoreDeletedRule() {
  const [addRuleToRuleGroup] = useAddRuleToRuleGroup();

  return useAsync(async (deletedRule: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
    const ruleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      namespaceName: deletedRule.grafana_alert.namespace_uid,
      groupName: deletedRule.grafana_alert.rule_group,
    };
    // save the new rule to the rule group
    return addRuleToRuleGroup.execute(ruleGroupIdentifier, deletedRule);
  });
}

const redirectToRestoreForm = async (ruleToRecover: RulerGrafanaRuleDTO) => {
  let formValues: Partial<RuleFormValues> | undefined;
  const namespaceName = await backendSrv
    .getFolderByUid(ruleToRecover.grafana_alert.namespace_uid)
    .then((folder) => folder.title);

  try {
    formValues = grafanaRuleDtoToFormValues(ruleToRecover, namespaceName);
  } catch (err) {
    const message = `Error getting rule values from the deleted rule: ${getMessageFromError(err)}`;
    throw new Error(message);
  }

  const urlPath = rulerRuleType.grafana.recordingRule(ruleToRecover)
    ? '/alerting/new/grafana-recording'
    : '/alerting/new';

  const ruleFormUrl = createRelativeUrl(urlPath, {
    isManualRestore: 'true',
    defaults: JSON.stringify(formValues),
    returnTo: window.location.pathname + window.location.search,
  });

  locationService.push(ruleFormUrl);
};
