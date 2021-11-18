import React, { useMemo } from 'react';

import { Button, Checkbox, Form, Modal, TextArea } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { SaveDashboardFormProps } from '../types';
import { getDashboardSaveModel } from 'app/features/dashboard/state/getDashboardSaveModel';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types';

interface SaveDashboardFormDTO {
  message: string;
  saveVariables: boolean;
  saveTimerange: boolean;
}

export const SaveDashboardForm: React.FC<SaveDashboardFormProps> = ({ dashboard, onCancel, onSuccess, onSubmit }) => {
  const hasTimeChanged = useMemo(() => dashboard.hasTimeChanged(), [dashboard]);
  const hasVariableChanged = useMemo(() => dashboard.hasVariableValuesChanged(), [dashboard]);
  const state = useSelector((state: StoreState) => state);

  return (
    <Form
      onSubmit={async (data: SaveDashboardFormDTO) => {
        if (!onSubmit) {
          return;
        }

        const saveModel = getDashboardSaveModel(state, data);
        const result = await onSubmit(saveModel, data, dashboard);

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
