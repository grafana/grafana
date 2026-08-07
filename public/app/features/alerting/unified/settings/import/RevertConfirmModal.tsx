import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfirmModal, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { logError } from '../../Analytics';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { stringifyErrorLike } from '../../utils/misc';

import { type StagedExtraConfig } from './stagedConfig';

interface Props {
  stagedConfig: StagedExtraConfig;
  onDismiss: () => void;
}

function ReassuranceRow({ children }: { children: NonNullable<React.ReactNode> }) {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="row" gap={1} alignItems="flex-start">
      <Icon name="check-circle" className={styles.checkIcon} />
      <Text color="secondary">{children}</Text>
    </Stack>
  );
}

/**
 * Confirmation modal for reverting (discarding) a staged Alertmanager config. Reassuring by design:
 * the live config is untouched and the config can be re-imported later, so the confirm is neutral
 * rather than destructive.
 */
export function RevertConfirmModal({ stagedConfig, onDismiss }: Props) {
  const notifyApp = useAppNotification();
  const [deleteStaged, { isLoading }] = convertToGMAApi.useDeleteStagedAlertmanagerConfigMutation();

  // A second DELETE would 404 and show a failure toast for a revert that actually succeeded.
  const onConfirm = useSingleFlight(async () => {
    try {
      await deleteStaged({ configIdentifier: stagedConfig.identifier }).unwrap();
      notifyApp.success(t('alerting.settings.import.revert.success', 'Staged configuration reverted'));
      onDismiss();
    } catch (err) {
      logError(new Error(stringifyErrorLike(err)));
      notifyApp.error(
        t('alerting.settings.import.revert.error-title', 'Failed to revert configuration'),
        stringifyErrorLike(err)
      );
    }
  });

  return (
    <ConfirmModal
      isOpen
      title={t('alerting.settings.import.revert.title', 'Revert this staged configuration?')}
      confirmText={t('alerting.settings.import.revert.confirm', 'Revert')}
      confirmVariant="secondary"
      onConfirm={onConfirm}
      // Prevent dismissing mid-revert so the mutation can't be interrupted.
      onDismiss={isLoading ? () => {} : onDismiss}
      body={
        <Stack direction="column" gap={2}>
          <Text>
            <Trans i18nKey="alerting.settings.import.revert.body">
              This removes the staged copy of the imported configuration from Grafana.
            </Trans>
          </Text>
          <Stack direction="column" gap={1}>
            <ReassuranceRow>
              <Trans i18nKey="alerting.settings.import.revert.reassure-live">
                Your live Alertmanager config is not affected.
              </Trans>
            </ReassuranceRow>
            <ReassuranceRow>
              <Trans i18nKey="alerting.settings.import.revert.reassure-promoted">
                Anything you already promoted stays in place.
              </Trans>
            </ReassuranceRow>
            <ReassuranceRow>
              <Trans i18nKey="alerting.settings.import.revert.reassure-reimport">
                You can import this configuration again at any time.
              </Trans>
            </ReassuranceRow>
          </Stack>
        </Stack>
      }
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  checkIcon: css({
    color: theme.colors.success.text,
    marginTop: theme.spacing(0.25),
  }),
});
