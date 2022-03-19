import React from 'react';
import { Field, Input, InputControl } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { useFormContext } from 'react-hook-form';
import { SaveToNewDashboardDTO } from '../types';

const ERRORS = {
  NAME_REQUIRED: 'Dashboard name is required.',
  INVALID_FOLDER: 'Select a valid folder to save your dashboard in.',
};

export const SaveToNewDashboard = () => {
  const {
    formState: { errors },
    register,
    control,
  } = useFormContext<SaveToNewDashboardDTO>();

  return (
    <>
      <p>Create a new dashboard and add a panel with the explored queries.</p>

      <Field
        label="Dashboard name"
        description="Choose a name for the new dashboard."
        error={errors.dashboardName?.message}
        invalid={!!errors.dashboardName}
      >
        <Input
          id="dashboard_name"
          {...register('dashboardName', {
            shouldUnregister: true,
            required: { value: true, message: ERRORS.NAME_REQUIRED },
            setValueAs(value: string) {
              return value.trim();
            },
          })}
          // we set default value here instead of in useForm because this input will be unregistered when switching
          // to "Existing Dashboard" and default values are not populated with manually registered
          // inputs (ie. when switching back to "New Dashboard")
          defaultValue="New dashboard (Explore)"
        />
      </Field>

      <InputControl
        render={({ field: { ref, onChange, ...field } }) => (
          <Field
            label="Folder"
            description="Select where the dashboard will be created."
            error={errors.folderId?.message}
            invalid={!!errors.folderId}
          >
            <FolderPicker onChange={(e) => onChange(e.id)} {...field} enableCreateNew inputId="folder" />
          </Field>
        )}
        control={control}
        name="folderId"
        shouldUnregister
        rules={{ required: { value: true, message: ERRORS.INVALID_FOLDER } }}
      />
    </>
  );
};
