import React, { useState } from 'react';

import { Button, Form, Modal, TextArea } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { DashboardModel } from 'app/features/dashboard/state';
import { SaveDashboardData, SaveDashboardOptions } from '../types';

interface FormDTO {
  message: string;
}

type Props = {
  dashboard: DashboardModel; // original
  saveModel: SaveDashboardData; // already cloned
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit?: (clone: any, options: SaveDashboardOptions, dashboard: DashboardModel) => Promise<any>;
  options: SaveDashboardOptions;
};

export const SaveDashboardForm2 = ({ dashboard, saveModel, options, onSubmit, onCancel, onSuccess }: Props) => {
  const [saving, setSaving] = useState(false);

  if (!saveModel.hasChanges) {
    return (
      <div>
        <p>No changes to save</p>
        <Button variant="secondary" onClick={onCancel} fill="outline">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Form
      onSubmit={async (data: FormDTO) => {
        if (!onSubmit) {
          return;
        }
        setSaving(true);
        const result = await onSubmit(saveModel.clone, options, dashboard);
        if (result.status === 'success') {
          if (options.saveVariables) {
            dashboard.resetOriginalVariables();
          }
          if (options.saveTimerange) {
            dashboard.resetOriginalTime();
          }
          onSuccess();
        }
        setSaving(false);
      }}
    >
      {({ register, errors }) => (
        <>
          <div>
            <TextArea {...register('message')} placeholder="Add a note to describe your changes." autoFocus rows={5} />
          </div>

          <Modal.ButtonRow>
            <Button variant="secondary" onClick={onCancel} fill="outline">
              Cancel
            </Button>
            <Button
              type="submit"
              icon={saving ? 'fa fa-spinner' : undefined}
              aria-label={selectors.pages.SaveDashboardModal.save}
            >
              {saving ? '' : 'Save'}
            </Button>
          </Modal.ButtonRow>
        </>
      )}
    </Form>
  );
};
