import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, locationUtil } from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { Alert, Button, Field, Input, RadioButtonGroup, Stack, TextArea } from '@grafana/ui';
import { RepositorySpec, RepositoryView } from 'app/api/clients/provisioning';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import kbn from 'app/core/utils/kbn';
import { AnnoKeyManagerIdentity, Resource } from 'app/features/apiserver/types';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';

import { getDashboardUrl } from '../../utils/getDashboardUrl';
import { SaveDashboardFormCommonOptions } from '../SaveDashboardForm';

import { SaveProvisionedDashboardProps } from './SaveProvisionedDashboard';
import { getWorkflowOptions } from './defaults';

type FormData = {
  ref?: string;
  path: string;
  comment?: string;
  repo: string;
  workflow?: WorkflowOption;
  title: string;
  description: string;
  folder: {
    uid?: string;
    title?: string;
  };
};

export interface Props extends SaveProvisionedDashboardProps {
  isNew: boolean;
  defaultValues: FormData;
  isGitHub: boolean;
  repositoryConfig?: RepositorySpec;
  loadedFromRef?: string;
}
export function SaveProvisionedDashboardForm({
  defaultValues,
  dashboard,
  drawer,
  changeInfo,
  isNew,
  loadedFromRef,
  repositoryConfig,
  isGitHub,
}: Props) {
  const navigate = useNavigate();
  const { meta } = dashboard.useState();
  const [action, request] = useCreateOrUpdateRepositoryFile(isNew ? undefined : defaultValues.path);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    control,
    setValue,
  } = useForm<FormData>({ defaultValues });

  const [ref, workflow, path] = watch(['ref', 'workflow', 'path']);

  useEffect(() => {
    const appEvents = getAppEvents();
    if (request.isSuccess) {
      dashboard.setState({ isDirty: false });
      if (workflow === 'branch' && ref !== '' && path !== '') {
        // Redirect to the provisioning preview pages
        navigate(`${PROVISIONING_URL}/${defaultValues.repo}/dashboard/preview/${path}?ref=${ref}`);
        return;
      }

      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Dashboard changes saved'],
      });

      // Load the new URL
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const upsert = request.data.resource.upsert as Resource<Dashboard>;
      if (isNew && upsert?.metadata?.name) {
        const url = locationUtil.assureBaseUrl(
          getDashboardUrl({
            uid: upsert.metadata.name,
            slug: kbn.slugifyForUrl(upsert.spec.title ?? ''),
            currentQueryParams: window.location.search,
          })
        );

        navigate(url);
        return;
      }

      // Keep the same URL
      dashboard.closeModal();
      locationService.partial({
        viewPanel: null,
        editPanel: null,
      });
    } else if (request.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error saving dashboard', request.error],
      });
    }
  }, [
    request.isSuccess,
    request.isError,
    request.error,
    request.data,
    dashboard,
    workflow,
    isNew,
    defaultValues.repo,
    ref,
    path,
    navigate,
  ]);

  const doSave = async ({ ref, path, comment, repo, title, description, folder }: FormData) => {
    if (!repo || !path) {
      return;
    }

    // The dashboard spec
    const saveModel = dashboard.getSaveAsModel({
      isNew: isNew,
      title: title,
      description: description,
    });

    if (workflow === 'write') {
      ref = loadedFromRef; // the original ref from URL or undefined
    }

    action({ ref, name: repo, path, message: comment, body: { ...saveModel, uid: meta.uid } });
  };

  const workflows = getWorkflowOptions(repositoryConfig, loadedFromRef);

  return (
    <form onSubmit={handleSubmit(doSave)} name="save-provisioned-form">
      <Stack direction="column" gap={2}>
        {!repositoryConfig?.workflows.length && (
          <Alert title="This repository is read only">
            If you have direct access to the target, copy the JSON and paste it there.
          </Alert>
        )}

        {isNew && (
          <>
            <Field label={'Title'} invalid={!!errors.title} error={errors.title?.message}>
              <Input
                id="dashboard-title"
                {...register('title', { required: 'Dashboard title is required', validate: validateDashboardName })}
              />
            </Field>
            <Field label="Description" invalid={!!errors.description} error={errors.description?.message}>
              <TextArea id="dashboard-description" {...register('description')} />
            </Field>

            <Field label={'Target folder'}>
              <Controller
                control={control}
                name={'folder'}
                render={({ field: { ref, value, onChange, ...field } }) => {
                  return (
                    <FolderPicker
                      inputId="dashboard-folder"
                      onChange={(uid?: string, title?: string, repository?: RepositoryView) => {
                        onChange({ uid, title });
                        const name = repository?.name;
                        if (name) {
                          setValue('repo', name);
                        }
                        dashboard.setState({
                          meta: {
                            k8s: name ? { annotations: { [AnnoKeyManagerIdentity]: name } } : undefined,
                            folderUid: uid,
                          },
                        });
                      }}
                      value={value.uid}
                      {...field}
                    />
                  );
                }}
              />
            </Field>
          </>
        )}

        {!isNew && <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />}

        <Field label="Path" description="File path inside the repository. This must be .json or .yaml">
          <Input id="dashboard-path" {...register('path')} readOnly={false} />
        </Field>

        <Field label="Comment">
          <TextArea
            id="dashboard-comment"
            {...register('comment')}
            aria-label="comment"
            placeholder="Add a note to describe your changes (optional)."
            autoFocus
            rows={5}
          />
        </Field>

        {isGitHub && (
          <>
            <Field label="Workflow">
              <Controller
                control={control}
                name={'workflow'}
                render={({ field: { ref, ...field } }) => {
                  return <RadioButtonGroup id="dashboard-workflow" {...field} options={workflows} />;
                }}
              />
            </Field>
            {workflow === 'branch' && (
              <Field
                label="Branch"
                description="Branch name in GitHub"
                invalid={!!errors?.ref}
                error={errors.ref ? <BranchValidationError /> : ''}
              >
                <Input id="dashboard-branch" {...register('ref', { validate: validateBranchName })} />
              </Field>
            )}
          </>
        )}
        <Stack gap={2}>
          <Button variant="primary" type="submit" disabled={request.isLoading}>
            {request.isLoading ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={drawer.onClose} fill="outline">
            Cancel
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

const BranchValidationError = () => {
  return (
    <>
      Invalid branch name.
      <ul style={{ padding: '0 20px' }}>
        <li>It cannot start with '/' or end with '/', '.', or whitespace.</li>
        <li>It cannot contain '//' or '..'.</li>
        <li>It cannot contain invalid characters: '~', '^', ':', '?', '*', '[', '\\', or ']'.</li>
        <li>It must have at least one valid character.</li>
      </ul>
    </>
  );
};

async function validateDashboardName(title: string, formValues: FormData) {
  if (title === formValues.folder.title?.trim()) {
    return 'Dashboard name cannot be the same as folder name';
  }

  try {
    await validationSrv.validateNewDashboardName(formValues.folder.uid ?? 'general', title);
    return true;
  } catch (e) {
    return e instanceof Error ? e.message : 'Dashboard name is invalid';
  }
}
