import { Trans, t } from '@grafana/i18n';
import { Alert, Stack } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { ProvisioningAlert } from 'app/features/provisioning/Shared/ProvisioningAlert';
import { RepoInvalidStateBanner } from 'app/features/provisioning/components/Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from 'app/features/provisioning/components/Shared/ResourceEditFormSharedFields';

interface Props {
  isReadOnlyRepo: boolean;
  isOrphaned: boolean;
  isLPBlocked?: boolean;
  canPushToConfiguredBranch: boolean;
  repository?: RepositoryView;
  error?: string;
}

export function ProvisionedImportFields({
  isReadOnlyRepo,
  isOrphaned,
  isLPBlocked = false,
  canPushToConfiguredBranch,
  repository,
  error,
}: Props) {
  return (
    <Stack direction="column" gap={2}>
      {(isReadOnlyRepo || isOrphaned) && (
        <RepoInvalidStateBanner noRepository={isOrphaned} isReadOnlyRepo={isReadOnlyRepo} />
      )}
      {isLPBlocked && (
        <Alert
          severity="warning"
          title={t('manage-dashboards.import-provisioned.library-panels-blocked-title', 'Library panels not supported')}
        >
          <Trans i18nKey="manage-dashboards.import-provisioned.library-panels-blocked-body">
            This dashboard contains library panels that cannot be created through a provisioned import. Import into a
            non-provisioned folder instead, or remove the library panel references first.
          </Trans>
        </Alert>
      )}
      {!isLPBlocked && !isReadOnlyRepo && !isOrphaned && (
        <ResourceEditFormSharedFields
          resourceType="dashboard"
          isNew
          canPushToConfiguredBranch={canPushToConfiguredBranch}
          repository={repository}
        />
      )}
      {error && <ProvisioningAlert error={error} />}
    </Stack>
  );
}
