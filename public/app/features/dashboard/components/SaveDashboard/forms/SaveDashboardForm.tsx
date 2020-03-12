import React, { useMemo } from 'react';
import { Forms, Button, HorizontalGroup } from '@grafana/ui';
import { e2e } from '@grafana/e2e';
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
    <Forms.Form
      onSubmit={async (data: SaveDashboardFormDTO) => {
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
          <Forms.Field label="Changes description">
            <Forms.TextArea
              name="message"
              ref={register}
              placeholder="Add a note to describe your changes..."
              autoFocus
            />
          </Forms.Field>
          {hasTimeChanged && (
            <Forms.Field label="Save current time range" description="Dashboard time range has changed">
              <Forms.Switch
                name="saveTimerange"
                ref={register}
                aria-label={e2e.pages.SaveDashboardModal.selectors.saveTimerange}
              />
            </Forms.Field>
          )}
          {hasVariableChanged && (
            <Forms.Field label="Save current variables" description="Dashboard variables have changed">
              <Forms.Switch
                name="saveVariables"
                ref={register}
                aria-label={e2e.pages.SaveDashboardModal.selectors.saveVariables}
              />
            </Forms.Field>
          )}

          <HorizontalGroup>
            <Button type="submit" aria-label={e2e.pages.SaveDashboardModal.selectors.save}>
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
