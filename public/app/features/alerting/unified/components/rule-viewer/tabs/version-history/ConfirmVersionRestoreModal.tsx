import { ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, ConfirmModal, Stack, Text } from '@grafana/ui';
import { useRuleWithLocation } from 'app/features/alerting/unified/hooks/useCombinedRule';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { rulerRuleToFormValues } from 'app/features/alerting/unified/utils/rule-form';
import { DiffGroup } from 'app/features/dashboard-scene/settings/version-history/DiffGroup';
import { jsonDiff } from 'app/features/dashboard-scene/settings/version-history/utils';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { useRestoreVersion } from './useRestoreVersion';
import { preprocessRuleForDiffDisplay } from './versions-utils';

export type Origin = 'version-list' | 'comparison-drawer';

type ModalProps = Pick<ComponentProps<typeof ConfirmModal>, 'isOpen' | 'onDismiss'> & {
  isOpen: boolean;
  baseVersion?: RulerGrafanaRuleDTO<GrafanaRuleDefinition>;
  versionToRestore?: RulerGrafanaRuleDTO<GrafanaRuleDefinition>;
  ruleIdentifier: GrafanaRuleIdentifier;
  onRestoreSucess: () => void;
  onRestoreError: (error: Error) => void;
};

export const ConfirmVersionRestoreModal = ({
  isOpen,
  baseVersion,
  versionToRestore,
  ruleIdentifier,
  onDismiss,
  onRestoreSucess,
  onRestoreError,
}: ModalProps) => {
  const { result: ruleWithLocation } = useRuleWithLocation({ ruleIdentifier });
  const navigate = useNavigate();
  const [restoreMethod, { error }] = useRestoreVersion();

  const title = t('alerting.alertVersionHistory.restore-modal.title', 'Restore version');
  const errorTitle = t('alerting.alertVersionHistory.restore-modal.error', 'Could not restore alert rule version ');
  const confirmText = !error
    ? t('alerting.alertVersionHistory.restore-modal.confirm', 'Yes, restore configuration')
    : 'Manually restore rule';

  const diff =
    baseVersion && versionToRestore
      ? jsonDiff(preprocessRuleForDiffDisplay(baseVersion), preprocessRuleForDiffDisplay(versionToRestore))
      : undefined;

  async function onRestoreConfirm() {
    if (!versionToRestore || !ruleWithLocation) {
      return;
    }
    return restoreMethod
      .execute(versionToRestore, ruleWithLocation)
      .then(() => {
        onDismiss();
        onRestoreSucess();
      })
      .catch((err) => {
        onRestoreError(err);
      });
  }

  async function onManualRestore() {
    if (!versionToRestore || !ruleWithLocation) {
      return;
    }
    const payload = rulerRuleToFormValues({ ...ruleWithLocation, rule: versionToRestore });
    const ruleFormUrl = urlUtil.renderUrl(`/alerting/${ruleIdentifier.uid}/edit`, {
      isManualRestore: true,
      defaults: JSON.stringify(payload),
      returnTo: window.location.pathname + window.location.search,
    });

    navigate(ruleFormUrl);
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      confirmText={confirmText}
      confirmButtonVariant={!error ? 'destructive' : 'primary'}
      body={
        <Stack direction="column" gap={2}>
          {!error && (
            <Trans i18nKey="alerting.alertVersionHistory.restore-modal.body">
              Are you sure you want to restore the alert rule definition to this version? All unsaved changes will be
              lost.
            </Trans>
          )}
          <Text variant="h6">
            <Trans i18nKey="alerting.alertVersionHistory.restore-modal.summary">
              Summary of changes to be applied:
            </Trans>
          </Text>
          <div>
            {diff && Object.entries(diff).map(([key, diffs]) => <DiffGroup diffs={diffs} key={key} title={key} />)}
          </div>
          {error && (
            <Alert severity="warning" title={errorTitle}>
              <Trans i18nKey="alerting.alertVersionHistory.restore-manually">
                Your alert rule could not be restored. This may be due to changes to other entities such as contact
                points, data sources etc. Please manually restore the rule version
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
