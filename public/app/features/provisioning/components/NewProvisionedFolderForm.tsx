import { css } from '@emotion/css';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Text, Button, Field, Icon, Input, Stack, useStyles2 } from '@grafana/ui';
import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView, useCreateRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath, Resource } from 'app/features/apiserver/types';
import { ResourceEditFormSharedFields } from 'app/features/dashboard-scene/components/Provisioned/ResourceEditFormSharedFields';
import { BaseProvisionedFormData } from 'app/features/dashboard-scene/saving/shared';
import { buildResourceBranchRedirectUrl } from 'app/features/dashboard-scene/settings/utils';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { FolderDTO } from 'app/types/folders';

import { validateFolderName } from '../../browse-dashboards/components/NewFolderForm';
import { formatFolderName, hasFolderNameCharactersToReplace } from '../../browse-dashboards/components/utils';
import { useProvisionedFolderFormData } from '../hooks/useProvisionedFolderFormData';
import { ProvisionedOperationInfo, useProvisionedRequestHandler } from '../hooks/useProvisionedRequestHandler';

import { RepoInvalidStateBanner } from './BulkActions/RepoInvalidStateBanner';

interface FormProps extends Props {
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  folder?: Folder;
}
interface Props {
  parentFolder?: FolderDTO;
  onDismiss?: () => void;
}

function FormContent({ initialValues, repository, workflowOptions, folder, onDismiss }: FormProps) {
  const { prURL } = usePullRequestParam();
  const navigate = useNavigate();
  const [create, request] = useCreateRepositoryFilesWithPathMutation();

  const methods = useForm<BaseProvisionedFormData>({
    defaultValues: initialValues,
    mode: 'onBlur', // Validates when user leaves the field
  });
  const { handleSubmit, watch, register, formState } = methods;

  const [workflow, title] = watch(['workflow', 'title']);

  const onBranchSuccess = ({ urls }: { urls?: Record<string, string> }, info: ProvisionedOperationInfo) => {
    const prUrl = urls?.newPullRequestURL;
    if (prUrl) {
      const url = buildResourceBranchRedirectUrl({
        paramName: 'new_pull_request_url',
        paramValue: prUrl,
        repoType: info.repoType,
      });
      navigate(url);
    }
  };

  const onWriteSuccess = (resource: Resource<FolderDTO>) => {
    // Navigation for new folders (resource-specific concern)
    if (resource?.metadata?.name) {
      navigate(`/dashboards/f/${resource.metadata.name}/`);
      return;
    }

    // Fallback to provisioning URL
    if (repository?.name && request.data?.path) {
      let url = `${PROVISIONING_URL}/${repository.name}/file/${request.data.path}`;
      if (request.data.ref?.length) {
        url += '?ref=' + request.data.ref;
      }
      navigate(url);
    }
  };

  const onError = (error: unknown) => {
    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload: [
        t('browse-dashboards.new-provisioned-folder-form.alert-error-creating-folder', 'Error creating folder'),
        error,
      ],
    });
  };

  // Use the repository-type and resource-type aware provisioned request handler
  useProvisionedRequestHandler<FolderDTO>({
    request,
    workflow,
    repository,
    resourceType: 'folder',
    handlers: {
      onDismiss,
      onBranchSuccess,
      onWriteSuccess: (_, resource) => onWriteSuccess(resource),
      onError,
    },
  });

  const doSave = async ({ ref, title, workflow, comment }: BaseProvisionedFormData) => {
    const repoName = repository?.name;
    if (!title || !repoName) {
      return;
    }
    const basePath = folder?.metadata?.annotations?.[AnnoKeySourcePath] ?? '';

    // Convert folder title to filename format (lowercase, replace spaces with hyphens)
    const titleInFilenameFormat = formatFolderName(title); // TODO: this is currently not working, issue created https://github.com/grafana/git-ui-sync-project/issues/314

    const prefix = basePath ? `${basePath}/` : '';
    const path = `${prefix}${titleInFilenameFormat}/`;

    const folderModel = {
      title,
      type: 'folder',
    };

    if (workflow === 'write') {
      ref = undefined;
    }

    create({
      ref,
      name: repoName,
      path,
      message: comment || `Create folder: ${title}`,
      body: folderModel,
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(doSave)}>
        <Stack direction="column" gap={2}>
          {!repository?.workflows?.length && (
            <Alert
              title={t(
                'browse-dashboards.new-provisioned-folder-form.title-this-repository-is-read-only',
                'This repository is read only'
              )}
            >
              <Trans i18nKey="browse-dashboards.text-this-repository-is-read-only">
                If you have direct access to the target, copy the JSON and paste it there.
              </Trans>
            </Alert>
          )}

          <Field
            noMargin
            label={t('browse-dashboards.new-provisioned-folder-form.label-folder-name', 'Folder name')}
            invalid={!!formState.errors.title}
            error={formState.errors.title?.message}
          >
            <Input
              {...register('title', {
                required: t('browse-dashboards.new-provisioned-folder-form.error-required', 'Folder name is required'),
                validate: validateFolderName,
              })}
              placeholder={t(
                'browse-dashboards.new-provisioned-folder-form.folder-name-input-placeholder-enter-folder-name',
                'Enter folder name'
              )}
              id="folder-name-input"
            />
          </Field>
          <FolderNamePreviewMessage folderName={title} />

          <ResourceEditFormSharedFields
            resourceType="folder"
            isNew={false}
            workflow={workflow}
            workflowOptions={workflowOptions}
            repository={repository}
            hidePath
          />

          {prURL && (
            <Alert
              severity="info"
              title={t(
                'browse-dashboards.new-provisioned-folder-form.title-pull-request-created',
                'Pull request created'
              )}
            >
              <Trans i18nKey="browse-dashboards.new-provisioned-folder-form.text-pull-request-created">
                A pull request has been created with changes to this folder:
              </Trans>{' '}
              <a href={prURL} target="_blank" rel="noopener noreferrer">
                {prURL}
              </a>
            </Alert>
          )}

          <Stack gap={2}>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              <Trans i18nKey="browse-dashboards.new-provisioned-folder-form.cancel">Cancel</Trans>
            </Button>
            <Button type="submit" disabled={request.isLoading}>
              {request.isLoading
                ? t('browse-dashboards.new-provisioned-folder-form.button-creating', 'Creating...')
                : t('browse-dashboards.new-provisioned-folder-form.button-create', 'Create')}
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

export function NewProvisionedFolderForm({ parentFolder, onDismiss }: Props) {
  const { workflowOptions, repository, folder, initialValues, isReadOnlyRepo } = useProvisionedFolderFormData({
    folderUid: parentFolder?.uid,
    action: 'create',
    title: '', // Empty title for new folders
  });

  if (isReadOnlyRepo || !initialValues) {
    return (
      <RepoInvalidStateBanner
        noRepository={!initialValues}
        isReadOnlyRepo={isReadOnlyRepo}
        readOnlyMessage={t(
          'browse-dashboards.new-folder.read-only-message',
          'To create this folder, please add the resource in your repository directly.'
        )}
      />
    );
  }

  return (
    <FormContent
      parentFolder={parentFolder}
      onDismiss={onDismiss}
      initialValues={initialValues}
      repository={repository}
      workflowOptions={workflowOptions}
      folder={folder}
    />
  );
}

function FolderNamePreviewMessage({ folderName }: { folderName: string }) {
  const styles = useStyles2(getStyles);
  const isValidFolderName =
    folderName.length && hasFolderNameCharactersToReplace(folderName) && validateFolderName(folderName);

  if (!isValidFolderName) {
    return null;
  }

  return (
    <div className={styles.folderNameMessage}>
      <Icon name="check-circle" type="solid" />
      <Text color="success">
        {t(
          'browse-dashboards.new-provisioned-folder-form.text-your-folder-will-be-created-as',
          'Your folder will be created as {{folderName}}',
          {
            folderName: formatFolderName(folderName),
          }
        )}
      </Text>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    folderNameMessage: css({
      display: 'flex',
      alignItems: 'center',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.success.text,
    }),
  };
};
