import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Drawer, Stack } from '@grafana/ui';
import { Job, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { StepStatusInfo } from 'app/features/provisioning/Wizard/types';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { StatusInfo } from '../../types';
import { BaseProvisionedFormData } from '../../types/form';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getCanPushToConfiguredBranch, getDefaultWorkflow } from '../defaults';

interface FixFolderMetadataDrawerProps {
  repositoryName: string;
  onDismiss: () => void;
}

export function FixFolderMetadataDrawer({ repositoryName, onDismiss }: FixFolderMetadataDrawerProps) {
  const { repository, isReadOnlyRepo, isLoading: repoLoading } = useGetResourceRepositoryView({ name: repositoryName });

  if (repoLoading) {
    return (
      <Drawer title={t('provisioning.fix-folder-metadata-drawer.title', 'Fix folder metadata')} onClose={onDismiss}>
        <Trans i18nKey="provisioning.fix-folder-metadata-drawer.loading">Loading repository...</Trans>
      </Drawer>
    );
  }

  if (isReadOnlyRepo || !repository) {
    return (
      <Drawer title={t('provisioning.fix-folder-metadata-drawer.title', 'Fix folder metadata')} onClose={onDismiss}>
        <RepoInvalidStateBanner
          noRepository={!repository}
          isReadOnlyRepo={isReadOnlyRepo}
          readOnlyMessage={t(
            'provisioning.fix-folder-metadata-drawer.read-only-message',
            'This repository is read-only. Folder metadata cannot be fixed automatically.'
          )}
        />
      </Drawer>
    );
  }

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);
  const defaultWorkflow = getDefaultWorkflow(repository);

  const defaultValues: BaseProvisionedFormData = {
    ref: repository.branch ?? '',
    path: '',
    comment: '',
    repo: repositoryName,
    workflow: defaultWorkflow,
    title: '',
  };

  return (
    <FixFolderMetadataForm
      repositoryName={repositoryName}
      repository={repository}
      canPushToConfiguredBranch={canPushToConfiguredBranch}
      defaultValues={defaultValues}
      onDismiss={onDismiss}
    />
  );
}

interface FixFolderMetadataFormProps {
  repositoryName: string;
  repository: NonNullable<ReturnType<typeof useGetResourceRepositoryView>['repository']>;
  canPushToConfiguredBranch: boolean;
  defaultValues: BaseProvisionedFormData;
  onDismiss: () => void;
}

function FixFolderMetadataForm({
  repositoryName,
  repository,
  canPushToConfiguredBranch,
  defaultValues,
  onDismiss,
}: FixFolderMetadataFormProps) {
  const [job, setJob] = useState<Job>();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [jobError, setJobError] = useState<string | StatusInfo>();
  const [createJob, createJobState] = useCreateRepositoryJobsMutation();

  const methods = useForm<BaseProvisionedFormData>({ defaultValues });
  const { handleSubmit } = methods;

  const handleSubmitForm = async ({ ref }: BaseProvisionedFormData) => {
    try {
      const result = await createJob({
        name: repositoryName,
        jobSpec: {
          action: 'fixFolderMetadata',
          fixFolderMetadata: { ref },
        },
      }).unwrap();

      if (result) {
        setJob(result);
        setHasSubmitted(true);
      }
    } catch {
      setJobError({
        title: t('provisioning.fix-folder-metadata-drawer.error-title', 'Error fixing folder metadata'),
        message: t(
          'provisioning.fix-folder-metadata-drawer.error-message',
          'Failed to start folder metadata fix job. Please try again.'
        ),
      });
    }
  };

  const handleJobStatusChange = useCallback((statusInfo: StepStatusInfo) => {
    if (statusInfo.status === 'error' && statusInfo.error) {
      setJobError(statusInfo.error);
    }
  }, []);

  return (
    <Drawer title={t('provisioning.fix-folder-metadata-drawer.title', 'Fix folder metadata')} onClose={onDismiss}>
      {hasSubmitted && job ? (
        <>
          <ProvisioningAlert error={jobError} />
          <JobStatus watch={job} jobType="fix" onStatusChange={handleJobStatusChange} />
        </>
      ) : (
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(handleSubmitForm)}>
            <Stack direction="column" gap={2}>
              <ProvisioningAlert error={jobError} />
              <ResourceEditFormSharedFields
                resourceType="folder"
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                hidePath
              />

              <Stack gap={2}>
                <Button variant="secondary" fill="outline" onClick={onDismiss}>
                  <Trans i18nKey="provisioning.fix-folder-metadata-drawer.cancel">Cancel</Trans>
                </Button>
                <Button type="submit" disabled={createJobState.isLoading}>
                  {createJobState.isLoading
                    ? t('provisioning.fix-folder-metadata-drawer.submitting', 'Fixing...')
                    : t('provisioning.fix-folder-metadata-drawer.submit', 'Fix folder IDs')}
                </Button>
              </Stack>
            </Stack>
          </form>
        </FormProvider>
      )}
    </Drawer>
  );
}
