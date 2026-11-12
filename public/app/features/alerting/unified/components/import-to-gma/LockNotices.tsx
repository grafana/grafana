import { Trans, t } from '@grafana/i18n';
import { Alert, Stack } from '@grafana/ui';

import { StagedImportSection } from '../../settings/import/StagedImportSection';

/**
 * Why the notifications step can't be used. Rule import doesn't depend on any of these, so the
 * rest of the wizard stays available.
 * - auto-sync: notification configuration is a read-only mirror of the synced data source.
 * - staged: an earlier import is still staged. It has to be promoted or reverted before another one.
 * - import-api-disabled: the Alertmanager import API is turned off, so its endpoints answer 501.
 */
export type NotificationsLock = 'auto-sync' | 'staged' | 'import-api-disabled';

export function ImportAPIDisabledNotice() {
  return (
    <Alert
      severity="info"
      title={t('alerting.import-to-gma.import-api-disabled.title', 'Notification configuration import is unavailable')}
    >
      <Trans i18nKey="alerting.import-to-gma.import-api-disabled.description">
        Importing notification configuration is not enabled on this Grafana instance. Continue to import rules.
      </Trans>
    </Alert>
  );
}

export function AutoSyncActiveNotice() {
  return (
    <Stack direction="column" gap={2}>
      <AutoSyncActiveAlert />
      <StagedImportSection />
    </Stack>
  );
}

export function StagedConfigNotice() {
  return (
    <Stack direction="column" gap={2}>
      <Alert
        severity="info"
        title={t('alerting.import-to-gma.staged-block.title', 'A configuration is already staged')}
      >
        <Trans i18nKey="alerting.import-to-gma.staged-block.description">
          Promote or revert the staged configuration below before importing another one, or continue to import rules.
        </Trans>
      </Alert>
      <StagedImportSection />
    </Stack>
  );
}

function AutoSyncActiveAlert() {
  return (
    <Alert severity="info" title={t('alerting.import-to-gma.autosync-active-block.title', 'Auto-sync is enabled')}>
      <Trans i18nKey="alerting.import-to-gma.autosync-active-block.description">
        Grafana is continuously syncing alert configuration from a data source, so notification configuration is a
        read-only mirror and cannot be imported into. Disable sync below to import notification configuration, or
        continue to import rules.
      </Trans>
    </Alert>
  );
}
