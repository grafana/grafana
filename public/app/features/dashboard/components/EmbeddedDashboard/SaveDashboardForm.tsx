import React, { useMemo, useState } from 'react';

import { Stack } from '@grafana/experimental';
import { Button, Form } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { DashboardModel } from '../../state';
import { SaveDashboardData } from '../SaveDashboard/types';

interface SaveDashboardProps {
  dashboard: DashboardModel;
  onCancel: () => void;
  onSubmit?: (clone: DashboardModel) => Promise<unknown>;
  onSuccess: () => void;
  saveModel: SaveDashboardData;
}
export const SaveDashboardForm = ({ dashboard, onCancel, onSubmit, onSuccess, saveModel }: SaveDashboardProps) => {
  const [saving, setSaving] = useState(false);
  const notifyApp = useAppNotification();
  const hasChanges = useMemo(() => dashboard.hasTimeChanged() || saveModel.hasChanges, [dashboard, saveModel]);

  const onFormSubmit = async () => {
    if (!onSubmit) {
      return;
    }
    setSaving(true);
    onSubmit(saveModel.clone)
      .then(() => {
        notifyApp.success('Dashboard saved locally');
        onSuccess();
      })
      .catch((error) => {
        notifyApp.error(error.message || 'Error saving dashboard');
      })
      .finally(() => setSaving(false));
  };

  return (
    <Form onSubmit={onFormSubmit}>
      {() => {
        return (
          <Stack gap={2}>
            <Stack alignItems="center">
              <Button variant="secondary" onClick={onCancel} fill="outline">
                Cancel
              </Button>
              <Button type="submit" disabled={!hasChanges} icon={saving ? 'fa fa-spinner' : undefined}>
                Save
              </Button>
              {!hasChanges && <div>No changes to save</div>}
            </Stack>
          </Stack>
        );
      }}
    </Form>
  );
};
