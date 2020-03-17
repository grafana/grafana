import React from 'react';
import { Button, Forms, HorizontalGroup } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { SaveDashboardFormProps } from '../types';

export const NEW_DASHBOARD_DEFAULT_TITLE = 'New dashboard';

interface SaveDashboardAsFormDTO {
  title: string;
  $folder: { id: number; title: string };
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

  return (
    <Forms.Form
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
      {({ register, control, errors }) => (
        <>
          <Forms.Field label="Dashboard name" invalid={!!errors.title} error="Dashboard name is required">
            <Forms.Input
              name="title"
              ref={register({ required: true })}
              aria-label="Save dashboard title field"
              autoFocus
            />
          </Forms.Field>
          <Forms.Field label="Folder">
            <Forms.InputControl
              as={FolderPicker}
              control={control}
              name="$folder"
              dashboardId={dashboard.id}
              initialFolderId={dashboard.meta.folderId}
              initialTitle={dashboard.meta.folderTitle}
              enableCreateNew
              useNewForms
            />
          </Forms.Field>
          <Forms.Field label="Copy tags">
            <Forms.Switch name="copyTags" ref={register} />
          </Forms.Field>
          <HorizontalGroup>
            <Button type="submit" aria-label="Save dashboard button">
              Save
            </Button>
            <Forms.Button variant="secondary" onClick={onCancel}>
              Cancel
            </Forms.Button>
          </HorizontalGroup>
        </>
      )}
    </Forms.Form>
  );
};
