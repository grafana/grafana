import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Alert, Button, Field, Input, RadioButtonGroup, Stack, TextArea } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { useUrlParams } from 'app/core/navigation/hooks';
import { AnnoKeyManagerIdentity, ManagerKind } from 'app/features/apiserver/types';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { RepositoryView } from 'app/features/provisioning/api';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';

import { DashboardScene } from '../../scene/DashboardScene';
import { SaveDashboardDrawer } from '../SaveDashboardDrawer';
import { SaveDashboardFormCommonOptions } from '../SaveDashboardForm';
import { DashboardChangeInfo } from '../shared';

import { getDefaultWorkflow, getWorkflowOptions } from './defaults';
import { useDefaultValues } from './hooks';

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

export interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard }: Props) {
  const { meta, title: defaultTitle, description: defaultDescription } = dashboard.useState();
  const navigate = useNavigate();
  const [params] = useUrlParams();
  const loadedFromRef = params.get('ref') ?? undefined;

  const {
    values: defaultValues,
    isNew,
    isGitHub,
    repositoryConfig,
  } = useDefaultValues({ meta, defaultTitle, defaultDescription });
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
  const { isDirty } = dashboard.state;

  useEffect(() => {
    const appEvents = getAppEvents();
    if (request.isSuccess) {
      dashboard.setState({ isDirty: false });
      if (isNew) {
        dashboard.setManager(ManagerKind.Repo, defaultValues.repo);
      }
      if (workflow === 'branch' && ref !== '' && path !== '') {
        // Redirect to the provisioning preview pages
        navigate(`${PROVISIONING_URL}/${defaultValues.repo}/dashboard/preview/${path}?ref=${ref}`);
      } else {
        appEvents.publish({
          type: AppEvents.alertSuccess.name,
          payload: ['Dashboard changes saved'],
        });
        dashboard.closeModal();
        locationService.partial({
          viewPanel: null,
          editPanel: null,
        });
      }
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
    dashboard,
    workflow,
    isNew,
    defaultValues.repo,
    ref,
    path,
    navigate,
  ]);

  useEffect(() => {
    setValue('workflow', getDefaultWorkflow(repositoryConfig));
  }, [repositoryConfig, setValue]);

  const doSave = async ({ ref, path, comment, repo, title, description }: FormData) => {
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

    // Quick hack to send the current UID without changing the whole shape
    (saveModel as any)['uid'] = meta.uid;

    action({ ref, name: repo, path, message: comment, body: saveModel });
  };

  const workflows = getWorkflowOptions(repositoryConfig, loadedFromRef);

  return (
    <form onSubmit={handleSubmit(doSave)}>
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
                {...register('title', { required: 'Dashboard title is required', validate: validateDashboardName })}
              />
            </Field>
            <Field label="Description" invalid={!!errors.description} error={errors.description?.message}>
              <TextArea {...register('description')} />
            </Field>

            <Field label={'Target folder'}>
              <Controller
                control={control}
                name={'folder'}
                render={({ field: { ref, value, onChange, ...field } }) => {
                  return (
                    <FolderPicker
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
          <Input {...register('path')} readOnly={false} />
        </Field>

        <Field label="Comment">
          <TextArea
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
                  return <RadioButtonGroup {...field} options={workflows} />;
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
                <Input {...register('ref', { validate: validateBranchName })} />
              </Field>
            )}
          </>
        )}
        <Stack gap={2}>
          <Button variant="primary" type="submit" disabled={request.isLoading || !isDirty}>
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
