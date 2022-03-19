import React, { useState } from 'react';
import { Alert, Button, InputControl, Modal, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { FormProvider, useForm } from 'react-hook-form';
import { SaveToNewDashboard } from './Forms/SaveToNewDashboard';
import { SaveToExistingDashboard } from './Forms/SaveToExistingDashboard';
import { SelectableValue } from '@grafana/data';
import { ErrorResponse, FormDTO, SaveTarget } from './types';
import { css } from '@emotion/css';

const ERRORS = {
  NAME_REQUIRED: 'Dashboard name is required.',
  NAME_EXISTS: 'A dashboard with the same name already exists in this folder.',
  NAME_MATCH: "Dashboard name cannot be the same as its folder's name.",
  INVALID_FIELD: 'This field is invalid.',
  UNKNOWN_ERROR: 'An unknown error occurred while saving the dashboard. Please try again.',
};

const SAVE_TARGETS: Array<SelectableValue<SaveTarget>> = [
  {
    label: 'New Dashboard',
    value: 'new_dashboard',
  },
  {
    label: 'Existing Dashboard',
    value: 'existing_dashboard',
  },
];

function withRedirect<T extends any[]>(fn: (redirect: boolean, ...args: T) => {}, redirect: boolean) {
  return async (...args: T) => fn(redirect, ...args);
}

interface Props {
  onClose: () => void;
  onSave: (data: FormDTO, redirect: boolean) => Promise<void | ErrorResponse>;
}

export const AddToDashboardModal = ({ onClose, onSave }: Props) => {
  const [submissionError, setSubmissionError] = useState<string>();
  const methods = useForm<FormDTO>({ defaultValues: { saveTarget: 'new_dashboard' } });
  const {
    handleSubmit,
    formState: { isSubmitting },
    control,
    setError,
    watch,
  } = methods;
  const FormComponent = watch('saveTarget') === 'new_dashboard' ? SaveToNewDashboard : SaveToExistingDashboard;
  const radioGroupStyles = useStyles2(
    (theme) => css`
      margin-bottom: ${theme.spacing(2)};
    `
  );

  const onSubmit = async (withRedirect: boolean, data: FormDTO) => {
    setSubmissionError(undefined);
    const error = await onSave(data, withRedirect);

    if (error) {
      switch (error.status) {
        case 'name-match':
          setError('dashboardName', { message: ERRORS.NAME_MATCH });
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
        <InputControl
          render={({ field: { ref, ...field } }) => (
            <RadioButtonGroup options={SAVE_TARGETS} {...field} className={radioGroupStyles} />
          )}
          control={control}
          name="saveTarget"
          shouldUnregister
        />

        <FormProvider {...methods}>
          <FormComponent />
        </FormProvider>

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
