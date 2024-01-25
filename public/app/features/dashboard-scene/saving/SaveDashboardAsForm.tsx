import React from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { Button, Input, Switch, Field, HorizontalGroup, Label, TextArea } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { DashboardModel } from 'app/features/dashboard/state';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import { DashboardChangeInfo } from './types';

interface SaveDashboardAsFormDTO {
  firstName?: string;
  title: string;
  description: string;
  folder: { uid?: string; title?: string };
  copyTags: boolean;
}

export interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
  isNew?: boolean;
}

export function SaveDashboardAsForm({ dashboard, drawer, changeInfo, isNew }: Props) {
  const { changedSaveModel } = changeInfo;

  const { register, handleSubmit, setValue, formState, getValues } = useForm<SaveDashboardAsFormDTO>({
    mode: 'onBlur',
    defaultValues: {
      title: isNew ? changedSaveModel.title! : `${changedSaveModel.title} Copy`,
      description: changedSaveModel.description ?? '',
      folder: {
        uid: dashboard.state.meta.folderUid,
        title: dashboard.state.meta.folderTitle,
      },
      copyTags: false,
    },
  });
  const { errors, isValid, defaultValues } = formState;
  const formValues = getValues();

  const isLoading = false;
  const onSubmit: SubmitHandler<SaveDashboardAsFormDTO> = (data) => console.log('submit', data);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Field
        label={
          <HorizontalGroup justify="space-between">
            <Label htmlFor="title">Title</Label>
            {/* {config.featureToggles.dashgpt && isNew && (
                      <GenAIDashTitleButton onGenerate={(title) => field.onChange(title)} dashboard={dashboard} />
                    )} */}
          </HorizontalGroup>
        }
        invalid={!!errors.title}
        error={errors.title?.message}
      >
        <Input
          {...register('title', { required: 'Required', validate: validateDashboardName })}
          aria-label="Save dashboard title field"
          autoFocus
        />
      </Field>
      <Field
        label={
          <HorizontalGroup justify="space-between">
            <Label htmlFor="description">Description</Label>
            {/* {config.featureToggles.dashgpt && isNew && (
                      <GenAIDashDescriptionButton
                        onGenerate={(description) => field.onChange(description)}
                        dashboard={dashboard}
                      />
                    )} */}
          </HorizontalGroup>
        }
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
          //  {...register('$folder', { required: false })}
          // {...field}
          // onChange={(uid: string | undefined, title: string | undefined) => field.onChange({ uid, title })}
          // value={field.value?.uid}
          // Old folder picker fields
          onChange={(uid: string | undefined, title: string | undefined) => setValue('folder', { uid, title })}
          value={formValues.folder.uid}
          initialTitle={defaultValues!.folder!.title}
          dashboardId={changedSaveModel.id ?? undefined}
          enableCreateNew
        />
      </Field>
      {!isNew && (
        <Field label="Copy tags">
          <Switch {...register('copyTags')} />
        </Field>
      )}
      <HorizontalGroup>
        <Button type="button" variant="secondary" onClick={drawer.onClose} fill="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={isValid || isLoading} aria-label="Save dashboard button">
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </HorizontalGroup>
    </form>
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

const getSaveAsDashboardClone = (dashboard: DashboardModel) => {
  const clone = dashboard.getSaveModelClone();
  clone.id = null;
  clone.uid = '';
  clone.title += ' Copy';
  clone.editable = true;

  // remove alerts if source dashboard is already persisted
  // do not want to create alert dupes
  if (dashboard.id > 0 && clone.panels) {
    clone.panels.forEach((panel) => {
      // @ts-expect-error
      if (panel.type === 'graph' && panel.alert) {
        // @ts-expect-error
        delete panel.thresholds;
      }
      // @ts-expect-error
      delete panel.alert;
    });
  }

  return clone;
};
