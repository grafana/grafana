import React, { useMemo } from 'react';

import { Button, Checkbox, Form, HorizontalGroup, TextArea } from '@grafana/ui';
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
          <div className="gf-form-group">
            {hasTimeChanged && (
              <Checkbox
                label="Save current time range as dashboard default"
                name="saveTimerange"
                ref={register}
                aria-label={selectors.pages.SaveDashboardModal.saveTimerange}
              />
            )}
            {hasVariableChanged && (
              <Checkbox
                label="Save current variable values as dashboard default"
                name="saveVariables"
                ref={register}
                aria-label={selectors.pages.SaveDashboardModal.saveVariables}
              />
            )}
            {(hasVariableChanged || hasTimeChanged) && <div className="gf-form-group" />}

            <TextArea name="message" ref={register} placeholder="Add a note to describe your changes..." autoFocus />
          </div>

          <HorizontalGroup>
            <Button type="submit" aria-label={selectors.pages.SaveDashboardModal.save}>
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
