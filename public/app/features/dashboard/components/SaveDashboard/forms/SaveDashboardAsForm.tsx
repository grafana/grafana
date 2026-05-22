import { ChangeEvent, useEffect, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { Button, Input, Switch, Form, Field, InputControl, Label, TextArea, Stack } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';

import { GenAIDashDescriptionButton } from '../../GenAI/GenAIDashDescriptionButton';
import { GenAIDashTitleButton } from '../../GenAI/GenAIDashTitleButton';
import { SaveDashboardFormProps } from '../types';

interface SaveDashboardAsFormDTO {
  title: string;
  description: string;
  $folder: { uid?: string; title?: string };
  copyTags: boolean;
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

export interface SaveDashboardAsFormProps extends SaveDashboardFormProps {
  isNew?: boolean;
}

export const SaveDashboardAsForm = ({
  dashboard,
  isLoading,
  isNew,
  onSubmit,
  onCancel,
  onSuccess,
}: SaveDashboardAsFormProps) => {
  const needsDefaultFolder = Boolean(isNew) && !dashboard.meta.folderUid;
  const [defaultFolderMatch, setDefaultFolderMatch] = useState<{ uid: string; title: string } | undefined>(undefined);
  const [folderSearchDone, setFolderSearchDone] = useState(!needsDefaultFolder);

  // NI fork: query by name so the result is not limited to the first pageful of folders.
  useEffect(() => {
    if (!needsDefaultFolder) {
      return;
    }
    getBackendSrv()
      .get<Array<{ uid: string; title: string }>>('/api/search', {
        type: 'dash-folder',
        query: 'Default Workspace',
        permission: 'Edit',
        limit: 1,
      })
      .then((results) => {
        const match = results.find((r) => r.title === 'Default Workspace');
        if (match) {
          setDefaultFolderMatch({ uid: match.uid, title: match.title });
        }
        setFolderSearchDone(true);
      })
      .catch(() => setFolderSearchDone(true));
  }, [needsDefaultFolder]);

  if (needsDefaultFolder && !folderSearchDone) {
    return null;
  }

  const defaultValues: SaveDashboardAsFormDTO = {
    title: isNew ? dashboard.title : `${dashboard.title} Copy`,
    description: dashboard.description,
    $folder: {
      uid: defaultFolderMatch?.uid ?? dashboard.meta.folderUid,
      title: defaultFolderMatch?.title ?? dashboard.meta.folderTitle,
    },
    copyTags: false,
  };

  const validateDashboardName = (getFormValues: () => SaveDashboardAsFormDTO) => async (dashboardName: string) => {
    if (dashboardName && dashboardName === getFormValues().$folder.title?.trim()) {
      return 'Dashboard name cannot be the same as folder name';
    }

    try {
      await validationSrv.validateNewDashboardName(getFormValues().$folder.uid ?? 'general', dashboardName);
      return true;
    } catch (e) {
      return e instanceof Error ? e.message : 'Dashboard name is invalid';
    }
  };

  return (
    <Form
      defaultValues={defaultValues}
      onSubmit={async (data: SaveDashboardAsFormDTO) => {
        if (!onSubmit) {
          return;
        }

        const clone = getSaveAsDashboardClone(dashboard);
        clone.title = data.title;
        clone.description = data.description;
        if (!isNew && !data.copyTags) {
          clone.tags = [];
        }

        const result = await onSubmit(
          clone,
          {
            folderUid: data.$folder.uid,
          },
          dashboard
        );

        if (result.status === 'success') {
          onSuccess();
        }
      }}
    >
      {({ register, control, errors, getValues }) => (
        <>
          <InputControl
            render={({ field: { ref, ...field } }) => (
              <Field
                label={
                  <Stack justifyContent="space-between">
                    <Label htmlFor="title">
                      <Trans i18nKey="dashboard.save-dashboard-as-form.title">Title</Trans>
                    </Label>
                    {config.featureToggles.dashgpt && isNew && (
                      <GenAIDashTitleButton onGenerate={(title) => field.onChange(title)} />
                    )}
                  </Stack>
                }
                invalid={!!errors.title}
                error={errors.title?.message}
              >
                <Input
                  {...field}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => field.onChange(e.target.value)}
                  aria-label={t(
                    'dashboard.save-dashboard-as-form.aria-label-save-dashboard-title-field',
                    'Save dashboard title field'
                  )}
                  autoFocus
                />
              </Field>
            )}
            control={control}
            name="title"
            rules={{
              validate: validateDashboardName(getValues),
            }}
          />
          <InputControl
            render={({ field: { ref, ...field } }) => (
              <Field
                label={
                  <Stack justifyContent="space-between">
                    <Label htmlFor="description">
                      <Trans i18nKey="dashboard.save-dashboard-as-form.description">Description</Trans>
                    </Label>
                    {config.featureToggles.dashgpt && isNew && (
                      <GenAIDashDescriptionButton onGenerate={(description) => field.onChange(description)} />
                    )}
                  </Stack>
                }
                invalid={!!errors.description}
                error={errors.description?.message}
              >
                <TextArea
                  {...field}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => field.onChange(e.target.value)}
                  aria-label={t(
                    'dashboard.save-dashboard-as-form.aria-label-save-dashboard-description-field',
                    'Save dashboard description field'
                  )}
                  autoFocus
                />
              </Field>
            )}
            control={control}
            name="description"
          />
          <Field label={t('dashboard.save-dashboard-as-form.label-folder', 'Folder')}>
            <InputControl
              render={({ field: { ref, ...field } }) => (
                <FolderPicker
                  {...field}
                  onChange={(uid: string | undefined, title: string | undefined) => field.onChange({ uid, title })}
                  value={field.value?.uid}
                  showRootFolder={false}
                />
              )}
              control={control}
              name="$folder"
            />
          </Field>
          {!isNew && (
            <Field label={t('dashboard.save-dashboard-as-form.label-copy-tags', 'Copy tags')}>
              <Switch {...register('copyTags')} />
            </Field>
          )}
          <Stack>
            <Button type="button" variant="secondary" onClick={onCancel} fill="outline">
              <Trans i18nKey="dashboard.save-dashboard-as-form.cancel">Cancel</Trans>
            </Button>
            <Button
              disabled={isLoading}
              type="submit"
              aria-label={t(
                'dashboard.save-dashboard-as-form.aria-label-save-dashboard-button',
                'Save dashboard button'
              )}
            >
              {isLoading
                ? t('dashboard.save-dashboard-as-form.saving', 'Saving...')
                : t('dashboard.save-dashboard-as-form.save', 'Save')}
            </Button>
          </Stack>
        </>
      )}
    </Form>
  );
};
