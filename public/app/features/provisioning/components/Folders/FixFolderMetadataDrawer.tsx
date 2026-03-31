import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Drawer, Stack } from '@grafana/ui';
import { type Job, type RepositoryView, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { type StepStatusInfo } from 'app/features/provisioning/Wizard/types';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { type StatusInfo } from '../../types';
import { type BaseProvisionedFormData } from '../../types/form';
import { useGetActiveJob } from '../../useGetActiveJob';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getCanPushToConfiguredBranch, getDefaultRef, getDefaultWorkflow } from '../defaults';

interface FixFolderMetadataDrawerProps {
  repositoryName: string;
  onDismiss: () => void;
}

export function FixFolderMetadataDrawer({ repositoryName, onDismiss }: FixFolderMetadataDrawerProps) {
  const [submittedJob, setSubmittedJob] = useState<Job>();
  const [jobError, setJobError] = useState<string | StatusInfo>();
  const [jobSuccess, setJobSuccess] = useState<string | StatusInfo>();
  const { repository, isReadOnlyRepo, isLoading: repoLoading } = useGetResourceRepositoryView({ name: repositoryName });

  const handleJobStatusChange = useCallback((statusInfo: StepStatusInfo) => {
    if (statusInfo.status === 'success') {
      setJobSuccess({
        title: t('provisioning.fix-folder-metadata-drawer.success-title', 'Folder metadata fixed successfully'),
      });
    }
    if (statusInfo.status === 'error' && statusInfo.error) {
      setJobError(statusInfo.error);
    }
  }, []);

  const drawerTitle = t('provisioning.fix-folder-metadata-drawer.title', 'Fix folder metadata');

  // Once the job is submitted, show only the job status view.
  // This skips the repository loading/readOnly checks below, so tag
  // invalidation from the mutation cannot cause the drawer to re-render
  // with a loading or error state.
  if (submittedJob) {
    return (
      <Drawer title={drawerTitle} onClose={onDismiss}>
        <ProvisioningAlert error={jobError} success={jobSuccess} />
        <JobStatus watch={submittedJob} jobType="fix" onStatusChange={handleJobStatusChange} />
      </Drawer>
    );
  }

  if (repoLoading) {
    return (
      <Drawer title={drawerTitle} onClose={onDismiss}>
        <Trans i18nKey="provisioning.fix-folder-metadata-drawer.loading">Loading repository...</Trans>
      </Drawer>
    );
  }

  if (isReadOnlyRepo || !repository) {
    return (
      <Drawer title={drawerTitle} onClose={onDismiss}>
        <RepoInvalidStateBanner
          noRepository={!repository}
          isReadOnlyRepo={isReadOnlyRepo}
          readOnlyMessage={t(
            'provisioning.fix-folder-metadata-drawer.read-only-message',
            'Folder metadata cannot be fixed automatically.'
          )}
        />
      </Drawer>
    );
  }

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);
  const defaultWorkflow = getDefaultWorkflow(repository);

  const defaultValues: BaseProvisionedFormData = {
    ref: getDefaultRef(repository, 'fix-folder-ids'),
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
      drawerTitle={drawerTitle}
      onDismiss={onDismiss}
      submitError={jobError}
      onJobCreated={setSubmittedJob}
      onSubmitError={setJobError}
    />
  );
}

interface FixFolderMetadataFormProps {
  repositoryName: string;
  repository: RepositoryView;
  canPushToConfiguredBranch: boolean;
  defaultValues: BaseProvisionedFormData;
  drawerTitle: string;
  onDismiss: () => void;
  submitError: string | StatusInfo | undefined;
  onJobCreated: (job: Job) => void;
  onSubmitError: (error: string | StatusInfo | undefined) => void;
}

function FixFolderMetadataForm({
  repositoryName,
  repository,
  canPushToConfiguredBranch,
  defaultValues,
  drawerTitle,
  onDismiss,
  submitError,
  onJobCreated,
  onSubmitError,
}: FixFolderMetadataFormProps) {
  const [createJob, createJobState] = useCreateRepositoryJobsMutation();
  const activeJob = useGetActiveJob(repositoryName);
  const isJobActive = activeJob?.status?.state === 'working' || activeJob?.status?.state === 'pending';

  const methods = useForm<BaseProvisionedFormData>({ defaultValues });
  const { handleSubmit } = methods;

  const handleSubmitForm = async ({ ref }: BaseProvisionedFormData) => {
    onSubmitError(undefined);
    try {
      const result = await createJob({
        name: repositoryName,
        jobSpec: {
          action: 'fixFolderMetadata',
          fixFolderMetadata: { ref },
        },
      }).unwrap();

      if (result) {
        onJobCreated(result);
      }
    } catch {
      onSubmitError({
        title: t('provisioning.fix-folder-metadata-drawer.error-title', 'Error fixing folder metadata'),
        message: t(
          'provisioning.fix-folder-metadata-drawer.error-message',
          'Failed to start folder metadata fix job. Please try again.'
        ),
      });
    }
  };

  return (
    <Drawer title={drawerTitle} onClose={onDismiss}>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleSubmitForm)}>
          <Stack direction="column" gap={2}>
            <ProvisioningAlert error={submitError} />
            <ResourceEditFormSharedFields
              resourceType="folder"
              canPushToConfiguredBranch={canPushToConfiguredBranch}
              repository={repository}
              hiddenFields={['path', 'comment']}
            />

            <Stack gap={2}>
              <Button variant="secondary" fill="outline" onClick={onDismiss}>
                <Trans i18nKey="provisioning.fix-folder-metadata-drawer.cancel">Cancel</Trans>
              </Button>
              <Button type="submit" disabled={createJobState.isLoading || isJobActive}>
                {createJobState.isLoading
                  ? t('provisioning.fix-folder-metadata-drawer.submitting', 'Fixing...')
                  : t('provisioning.fix-folder-metadata-drawer.submit', 'Fix folder IDs')}
              </Button>
            </Stack>
          </Stack>
        </form>
      </FormProvider>
    </Drawer>
  );
}
