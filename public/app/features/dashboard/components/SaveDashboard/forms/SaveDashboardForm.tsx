import React, { useMemo } from 'react';

import { Button, Checkbox, Form, Modal, TextArea } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { SaveDashboardFormProps } from '../types';

interface SaveDashboardFormDTO {
  message: string;
  saveVariables: boolean;
  saveTimerange: boolean;
}

export const SaveDashboardForm: React.FC<SaveDashboardFormProps> = ({ dashboard, onCancel, onSuccess, onSubmit }) => {
  const hasTimeChanged = useMemo(() => dashboard.hasTimeChanged(), [dashboard]);
  const hasVariableChanged = useMemo(() => dashboard.hasVariableValuesChanged(), [dashboard]);

  return (
    <Form
      onSubmit={async (data: SaveDashboardFormDTO) => {
        if (!onSubmit) {
          return;
        }

        const result = await onSubmit(dashboard.getSaveModelClone(data), data, dashboard);
        if (result.status === 'success') {
          if (data.saveVariables) {
            dashboard.resetOriginalVariables();
          }
          if (data.saveTimerange) {
            dashboard.resetOriginalTime();
          }
          onSuccess();
        }
      }}
    >
      {({ register, errors }) => (
        <>
          <div>
            {hasTimeChanged && (
              <Checkbox
                {...register('saveTimerange')}
                label="Save current time range as dashboard default"
                aria-label={selectors.pages.SaveDashboardModal.saveTimerange}
              />
            )}
            {hasVariableChanged && (
              <Checkbox
                {...register('saveVariables')}
                label="Save current variable values as dashboard default"
                aria-label={selectors.pages.SaveDashboardModal.saveVariables}
              />
            )}
            {(hasVariableChanged || hasTimeChanged) && <div className="gf-form-group" />}

            <TextArea {...register('message')} placeholder="Add a note to describe your changes." autoFocus />
          </div>

          <Modal.ButtonRow>
            <Button variant="secondary" onClick={onCancel} fill="outline">
              Cancel
            </Button>
            <Button type="submit" aria-label={selectors.pages.SaveDashboardModal.save}>
              Save
            </Button>
          </Modal.ButtonRow>
        </>
      )}
    </Form>
  );
};
