import React from 'react';
import { Field, InputControl } from '@grafana/ui';
import { useFormContext } from 'react-hook-form';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { SaveToExistingDashboardDTO } from '../types';

const ERRORS = {
  INVALID_DASHBOARD: 'Select a valid dashboard to save your panel in.',
};

export const SaveToExistingDashboard = () => {
  const {
    formState: { errors },
    control,
  } = useFormContext<SaveToExistingDashboardDTO>();

  return (
    <>
      <p>Add a panel with the explored queries to an existing dashboard.</p>

      <InputControl
        render={({ field: { ref, value, ...field } }) => (
          <Field
            label="Dashboard"
            description="Select in which dashboard the panel will be created."
            // @ts-expect-error this is because of a limitation with react-hook-form using objects
            // as values where errors can only be mapped to leaf properties.
            error={errors.dashboard?.message}
            invalid={!!errors.dashboard}
          >
            <DashboardPicker
              // TODO: since the search APIs do not support filtering for writable dashboards here we get all the dashboards,
              // even if they are not writable. Ideally we should filter them out.
              {...field}
              value={value?.uid}
              inputId="e2d-dashboard-picker"
              defaultOptions
              aria-label="Save target"
            />
          </Field>
        )}
        control={control}
        name="dashboard"
        shouldUnregister
        rules={{ required: { value: true, message: ERRORS.INVALID_DASHBOARD } }}
      />
    </>
  );
};
