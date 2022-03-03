import React, { useState } from 'react';
import { DataQuery } from '@grafana/data';
import { Alert, Button, Field, Input, InputControl, Modal } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { useForm } from 'react-hook-form';
import { SaveToNewDashboardDTO } from './addToDashboard';

export interface ErrorResponse {
  status: string;
  message?: string;
}

const ERRORS = {
  NAME_REQUIRED: 'Dashboard name is required.',
  NAME_EXISTS: 'A dashboard with the same name already exists in this folder.',
  INVALID_FIELD: 'This field is invalid.',
  UNKNOWN_ERROR: 'An unknown error occurred while saving the dashboard. Please try again.',
  INVALID_FOLDER: 'Select a valid folder to save your dashboard in.',
};

type FormDTO = SaveToNewDashboardDTO;

interface Props {
  onClose: () => void;
  queries: DataQuery[];
  visualization: string;
  onSave: (data: FormDTO, redirect: boolean) => Promise<void | ErrorResponse>;
}

function withRedirect<T extends any[]>(fn: (redirect: boolean, ...args: T) => {}, redirect: boolean) {
  return async (...args: T) => fn(redirect, ...args);
}

export const AddToDashboardModal = ({ onClose, queries, visualization, onSave }: Props) => {
  const [submissionError, setSubmissionError] = useState<string>();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormDTO>({ defaultValues: { queries, visualization } });

  const onSubmit = async (withRedirect: boolean, data: FormDTO) => {
    setSubmissionError(undefined);
    const error = await onSave(data, withRedirect);

    if (error) {
      switch (error.status) {
        case 'name-match':
          // error.message should always be defined here
          setError('dashboardName', { message: error.message ?? ERRORS.INVALID_FIELD });
          break;
        case 'empty-name':
          setError('dashboardName', { message: ERRORS.NAME_REQUIRED });
          break;
        case 'name-exists':
          setError('dashboardName', { message: ERRORS.NAME_EXISTS });
          break;
        default:
          setSubmissionError(error.message ?? ERRORS.UNKNOWN_ERROR);
      }
    }
  };

  return (
    <Modal title="Add panel to dashboard" onDismiss={onClose} isOpen>
      <form>
        <input type="hidden" {...register('queries')} />
        <input type="hidden" {...register('visualization')} />

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

        <Field
          label="Folder"
          description="Select where the dashboard will be created."
          error={errors.folderId?.message}
          invalid={!!errors.folderId}
        >
          <InputControl
            render={({ field: { ref, onChange, ...field } }) => (
              <FolderPicker onChange={(e) => onChange(e.id)} {...field} enableCreateNew inputId="folder" />
            )}
            control={control}
            name="folderId"
            shouldUnregister
            rules={{ required: { value: true, message: ERRORS.INVALID_FOLDER } }}
          />
        </Field>

        {submissionError && (
          <Alert severity="error" title="Unknown error">
            {submissionError}
          </Alert>
        )}

        <Modal.ButtonRow>
          <Button type="reset" onClick={onClose} fill="outline" variant="secondary" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit(withRedirect(onSubmit, false))}
            variant="secondary"
            icon="compass"
            disabled={isSubmitting}
          >
            Save and keep exploring
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit(withRedirect(onSubmit, true))}
            variant="primary"
            icon="apps"
            disabled={isSubmitting}
          >
            Save and go to dashboard
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};
