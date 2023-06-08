import React, { useState } from 'react';

import { Stack } from '@grafana/experimental';
import { Button, Form } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { DashboardModel } from '../../state';
import { SaveDashboardData, SaveDashboardOptions } from '../SaveDashboard/types';

interface FormDTO {
  message: string;
}

interface SaveDashboardProps {
  dashboard: DashboardModel; // original
  saveModel: SaveDashboardData; // already cloned
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit?: (clone: DashboardModel) => Promise<unknown>;
  options: SaveDashboardOptions;
  onOptionsChange: (opts: SaveDashboardOptions) => void;
}
export const SaveDashboardForm = ({ saveModel, options, onSubmit, onCancel, onSuccess }: SaveDashboardProps) => {
  const [saving, setSaving] = useState(false);
  const notifyApp = useAppNotification();

  return (
    <Form
      onSubmit={async (data: FormDTO) => {
        if (!onSubmit) {
          return;
        }
        setSaving(true);
        options = { ...options, message: data.message };
        onSubmit(saveModel.clone)
          .then(() => {
            notifyApp.success('Dashboard saved');
            onSuccess();
          })
          .catch((error) => {
            notifyApp.error(error.message || 'Error saving dashboard');
          })
          .finally(() => setSaving(false));
      }}
    >
      {() => {
        return (
          <Stack gap={2}>
            <Stack alignItems="center">
              <Button variant="secondary" onClick={onCancel} fill="outline">
                Cancel
              </Button>
              <Button type="submit" disabled={!saveModel.hasChanges} icon={saving ? 'fa fa-spinner' : undefined}>
                Save
              </Button>
              {!saveModel.hasChanges && <div>No changes to save</div>}
            </Stack>
          </Stack>
        );
      }}
    </Form>
  );
};
