import React from 'react';
import { Button, HorizontalGroup, Input, Switch, Form, Field, InputControl } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { SaveDashboardFormProps } from '../types';
import validationSrv from 'app/features/manage-dashboards/services/ValidationSrv';

interface SaveDashboardAsFormDTO {
  title: string;
  $folder: { id?: number; title?: string };
  copyTags: boolean;
}

const getSaveAsDashboardClone = (dashboard: DashboardModel) => {
  const clone: any = dashboard.getSaveModelClone();
  clone.id = null;
  clone.uid = '';
  clone.title += ' Copy';
  clone.editable = true;
  clone.hideControls = false;

  // remove alerts if source dashboard is already persisted
  // do not want to create alert dupes
  if (dashboard.id > 0) {
    clone.panels.forEach((panel: PanelModel) => {
      if (panel.type === 'graph' && panel.alert) {
        delete panel.thresholds;
      }
      delete panel.alert;
    });
  }

  delete clone.autoUpdate;
  return clone;
};

export const SaveDashboardAsForm: React.FC<SaveDashboardFormProps & { isNew?: boolean }> = ({
  dashboard,
  onSubmit,
  onCancel,
  onSuccess,
}) => {
  const defaultValues: SaveDashboardAsFormDTO = {
    title: `${dashboard.title} Copy`,
    $folder: {
      id: dashboard.meta.folderId,
      title: dashboard.meta.folderTitle,
    },
    copyTags: false,
  };

  const validateDashboardName = (getFormValues: () => SaveDashboardAsFormDTO) => async (dashboardName: string) => {
    if (dashboardName && dashboardName === getFormValues().$folder.title?.trim()) {
      return 'Dashboard name cannot be the same as folder';
    }
    try {
      await validationSrv.validateNewDashboardName(getFormValues().$folder.id, dashboardName);
      return true;
    } catch (e) {
      return e.message;
    }
  };

  return (
    <Form
      defaultValues={defaultValues}
      onSubmit={async (data: SaveDashboardAsFormDTO) => {
        const clone = getSaveAsDashboardClone(dashboard);
        clone.title = data.title;
        if (!data.copyTags) {
          clone.tags = [];
        }

        const result = await onSubmit(
          clone,
          {
            folderId: data.$folder.id,
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
          <Field label="Dashboard name" invalid={!!errors.title} error={errors.title?.message}>
            <Input
              name="title"
              ref={register({
                validate: validateDashboardName(getValues),
              })}
              aria-label="Save dashboard title field"
              autoFocus
            />
          </Field>
          <Field label="Folder">
            <InputControl
              as={FolderPicker}
              control={control}
              name="$folder"
              dashboardId={dashboard.id}
              initialFolderId={dashboard.meta.folderId}
              initialTitle={dashboard.meta.folderTitle}
              enableCreateNew
              useNewForms
            />
          </Field>
          <Field label="Copy tags">
            <Switch name="copyTags" ref={register} />
          </Field>
          <HorizontalGroup>
            <Button type="submit" aria-label="Save dashboard button">
              Save
            </Button>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </HorizontalGroup>
        </>
      )}
    </Form>
  );
};
