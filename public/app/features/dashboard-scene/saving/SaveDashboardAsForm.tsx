import debounce from 'debounce-promise';
import { ChangeEvent, useState } from 'react';
import { UseFormSetValue, useForm } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Input, Switch, Field, Label, TextArea, Stack, Alert, Box } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardChangeInfo, NameAlreadyExistsError, SaveButton, isNameExistsError } from './shared';
import { useSaveDashboard } from './useSaveDashboard';

interface SaveDashboardAsFormDTO {
  firstName?: string;
  title: string;
  description: string;
  folder: { uid?: string; title?: string };
  copyTags: boolean;
}

export interface Props {
  dashboard: DashboardScene;
  changeInfo: DashboardChangeInfo;
}

export function SaveDashboardAsForm({ dashboard, changeInfo }: Props) {
  const { changedSaveModel } = changeInfo;

  const { register, handleSubmit, setValue, formState, getValues, watch } = useForm<SaveDashboardAsFormDTO>({
    mode: 'onBlur',
    defaultValues: {
      title: changeInfo.isNew ? changedSaveModel.title! : `${changedSaveModel.title} Copy`,
      description: changedSaveModel.description ?? '',
      folder: {
        uid: dashboard.state.meta.folderUid,
        title: dashboard.state.meta.folderTitle,
      },
      copyTags: false,
    },
  });

  const { errors, isValid, defaultValues } = formState;
  const formValues = watch();

  const { state, onSaveDashboard } = useSaveDashboard(false);

  const [contentSent, setContentSent] = useState<{ title?: string; folderUid?: string }>({});
  const [hasFolderChanged, setHasFolderChanged] = useState(false);
  const onSave = async (overwrite: boolean) => {
    const data = getValues();

    const result = await onSaveDashboard(dashboard, {
      overwrite,
      folderUid: data.folder.uid,

      // save as config
      saveAsCopy: true,
      isNew: changeInfo.isNew,
      copyTags: data.copyTags,
      title: data.title,
      description: data.description,
    });

    if (result.status === 'success') {
      dashboard.closeModal();
    } else {
      setContentSent({
        title: data.title,
        folderUid: data.folder.uid,
      });
    }
  };

  const cancelButton = (
    <Button variant="secondary" onClick={() => dashboard.closeModal()} fill="outline">
      Cancel
    </Button>
  );

  const saveButton = (overwrite: boolean) => {
    const showSaveButton = !isValid && hasFolderChanged ? true : isValid;
    return <SaveButton isValid={showSaveButton} isLoading={state.loading} onSave={onSave} overwrite={overwrite} />;
  };
  function renderFooter(error?: Error) {
    const formValuesMatchContentSent =
      formValues.title.trim() === contentSent.title && formValues.folder.uid === contentSent.folderUid;
    if (isNameExistsError(error) && formValuesMatchContentSent) {
      return <NameAlreadyExistsError cancelButton={cancelButton} saveButton={saveButton} />;
    }
    return (
      <>
        {error && formValuesMatchContentSent && (
          <Alert title="Failed to save dashboard" severity="error">
            {error.message && <p>{error.message}</p>}
          </Alert>
        )}
        <Stack alignItems="center">
          {cancelButton}
          {saveButton(false)}
        </Stack>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit(() => onSave(false))}>
      <Field label={<TitleFieldLabel onChange={setValue} />} invalid={!!errors.title} error={errors.title?.message}>
        <Input
          {...register('title', { required: 'Required', validate: validateDashboardName })}
          aria-label="Save dashboard title field"
          data-testid={selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput}
          onChange={debounce(async (e: ChangeEvent<HTMLInputElement>) => {
            setValue('title', e.target.value, { shouldValidate: true });
          }, 400)}
        />
      </Field>
      <Field
        label={<DescriptionLabel onChange={setValue} />}
        invalid={!!errors.description}
        error={errors.description?.message}
      >
        <TextArea
          {...register('description', { required: false })}
          aria-label="Save dashboard description field"
          autoFocus
        />
      </Field>

      <Field label="Folder">
        <FolderPicker
          onChange={(uid: string | undefined, title: string | undefined) => {
            setValue('folder', { uid, title });
            const folderUid = dashboard.state.meta.folderUid;
            setHasFolderChanged(uid !== folderUid);
          }}
          // Old folder picker fields
          value={formValues.folder?.uid}
          initialTitle={defaultValues!.folder!.title}
          dashboardId={dashboard.state.id ?? undefined}
          enableCreateNew
        />
      </Field>
      {!changeInfo.isNew && (
        <Field label="Copy tags">
          <Switch {...register('copyTags')} />
        </Field>
      )}
      <Box paddingTop={2}>{renderFooter(state.error)}</Box>
    </form>
  );
}

export interface TitleLabelProps {
  onChange: UseFormSetValue<SaveDashboardAsFormDTO>;
}

export function TitleFieldLabel(props: TitleLabelProps) {
  return (
    <Stack justifyContent="space-between">
      <Label htmlFor="description">Title</Label>
      {/* {config.featureToggles.dashgpt && isNew && (
                <GenAIDashDescriptionButton
                  onGenerate={(description) => field.onChange(description)}
                  dashboard={dashboard}
                />
              )} */}
    </Stack>
  );
}

export interface DescriptionLabelProps {
  onChange: UseFormSetValue<SaveDashboardAsFormDTO>;
}

export function DescriptionLabel(props: DescriptionLabelProps) {
  return (
    <Stack justifyContent="space-between">
      <Label htmlFor="description">Description</Label>
      {/* {config.featureToggles.dashgpt && isNew && (
                <GenAIDashDescriptionButton
                  onGenerate={(description) => field.onChange(description)}
                  dashboard={dashboard}
                />
              )} */}
    </Stack>
  );
}

async function validateDashboardName(title: string, formValues: SaveDashboardAsFormDTO) {
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
