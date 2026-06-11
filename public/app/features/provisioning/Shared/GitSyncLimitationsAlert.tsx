import { useBooleanFlagValue } from '@openfeature/react-sdk';

import { t, Trans } from '@grafana/i18n';
import { Alert, Stack, Text, TextLink } from '@grafana/ui';

import { ANNOUNCEMENT_BANNER_DOCS_URL, GIT_SYNC_DOCS_URL } from '../constants';

interface GitSyncLimitationsAlertProps {
  /**
   * Tailors the limitations to the migration scope. `instance` warns that alerts
   * and library panels are lost; `folder` explains the folder-structure caveats.
   */
  syncTarget?: 'instance' | 'folder';
}

/**
 * Warning shown before starting a Git Sync migration. Shared between the
 * onboarding wizard and the Migrate to GitOps tool so both surface the same
 * limitations and the advice to enable the announcement banner.
 */
export function GitSyncLimitationsAlert({ syncTarget }: GitSyncLimitationsAlertProps) {
  const provisioningFolderMetadataEnabled = useBooleanFlagValue('provisioningFolderMetadata', false);

  return (
    <Alert
      title={t('provisioning.wizard.alert-title', 'Important: Review Git Sync limitations before proceeding')}
      severity="warning"
    >
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="provisioning.wizard.alert-intro">
            Please be aware of the following limitations. For more details, see the{' '}
            <TextLink external href={GIT_SYNC_DOCS_URL}>
              Git Sync documentation
            </TextLink>
            .
          </Trans>
        </Text>
        <ul style={{ marginLeft: '16px', marginTop: 0, marginBottom: 0 }}>
          <li>
            <Trans i18nKey="provisioning.wizard.alert-point-1">
              Resources can still be created, edited, or deleted during this process, but changes may not be exported.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="provisioning.wizard.alert-point-unsupported">
              Alerts and library panels are not supported in provisioned folders.
            </Trans>
          </li>
          {!provisioningFolderMetadataEnabled && (
            <li>
              <Trans i18nKey="provisioning.wizard.alert-point-permissions">
                Fine-grained permissions are not supported. Default permissions apply: Admin, Editor, and Viewer roles
                are preserved with their standard access levels.
              </Trans>
            </li>
          )}
          <li>
            <Trans i18nKey="provisioning.wizard.alert-point-3">
              The duration of this process depends on the number of resources involved.
            </Trans>
          </li>
          {syncTarget === 'instance' && (
            <li>
              <Trans i18nKey="provisioning.wizard.alert-point-instance-alerts">
                Existing alerts and library panels will be lost and will not be usable after migration.
              </Trans>
            </li>
          )}
          {syncTarget === 'folder' && (
            <>
              <li>
                <Trans i18nKey="provisioning.wizard.alert-point-folder-structure">
                  When migrating existing dashboards, the folder structure will be replicated in the repository.
                  Original folders will be emptied of dashboards but may still contain alerts or library panels.
                </Trans>
              </li>
              <li>
                <Trans i18nKey="provisioning.wizard.alert-point-folder-cleanup">
                  You may need to manually remove or manage original folders after migration.
                </Trans>
              </li>
            </>
          )}
        </ul>
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.wizard.alert-point-4">
            Enterprise instance administrators can display an announcement banner to notify users that migration is in
            progress. See{' '}
            <TextLink external variant="bodySmall" href={ANNOUNCEMENT_BANNER_DOCS_URL}>
              this guide
            </TextLink>{' '}
            for step-by-step instructions.
          </Trans>
        </Text>
      </Stack>
    </Alert>
  );
}
