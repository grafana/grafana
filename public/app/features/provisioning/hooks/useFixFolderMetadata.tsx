import { t, Trans } from '@grafana/i18n';
import { Spinner } from '@grafana/ui';
import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { dispatch } from 'app/store/store';

import { useGetActiveJob } from '../useGetActiveJob';

export function useFixFolderMetadata(repositoryName: string) {
  const [createJob, jobQuery] = useCreateRepositoryJobsMutation();
  const activeJob = useGetActiveJob(repositoryName);
  const isJobRunning =
    jobQuery.isLoading || activeJob?.status?.state === 'working' || activeJob?.status?.state === 'pending';

  const onFixFolderMetadata = () => {
    if (!repositoryName || isJobRunning) {
      return;
    }
    createJob({ name: repositoryName, jobSpec: { action: 'fixFolderMetadata', fixFolderMetadata: {} } })
      .unwrap()
      .then(() => {
        dispatch(
          notifyApp(
            createSuccessNotification(
              t(
                'provisioning.fix-folder-metadata.success',
                'Folder metadata fix started. This will continue in the background.'
              )
            )
          )
        );
      })
      .catch(() => {
        dispatch(
          notifyApp(
            createErrorNotification(t('provisioning.fix-folder-metadata.error-fixing', 'Error fixing folder metadata'))
          )
        );
      });
  };

  const buttonContent = isJobRunning ? (
    <>
      <Spinner size="xs" inline /> <Trans i18nKey="provisioning.fix-folder-metadata.fixing">Fixing...</Trans>
    </>
  ) : (
    <Trans i18nKey="provisioning.fix-folder-metadata.button">Fix folder IDs</Trans>
  );

  return { onFixFolderMetadata, buttonContent, isJobRunning };
}
