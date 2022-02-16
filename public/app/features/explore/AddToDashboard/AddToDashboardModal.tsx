import { DataQuery, SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, Field, Input, InputControl, Modal, RadioButtonGroup } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { DashboardPicker } from 'app/core/components/editors/DashboardPicker';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import React, { useState } from 'react';
import { DeepMap, FieldError, useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { addToDashboard, SaveToExistingDashboardDTO, SaveToNewDashboardDTO } from './addToDashboard';

const isSaveToNewDashboard = (
  errors: DeepMap<FormDTO, FieldError>,
  saveTarget: SaveTarget
): errors is DeepMap<SaveToNewDashboardDTO, FieldError> => saveTarget === 'new';

const options: Array<SelectableValue<SaveTarget>> = [
  { label: 'New dashboard', value: 'new' },
  { label: 'Existing dashboard', value: 'existing' },
];

type SaveTarget = 'new' | 'existing';

type FormDTO = SaveToExistingDashboardDTO | SaveToNewDashboardDTO;

interface Props {
  onClose: () => void;
  queries: DataQuery[];
  visualization: string;
}

function withRedirect<T extends any[]>(fn: (...args: T) => Promise<string>) {
  return async (...args: T) => locationService.push(await fn(...args));
}

export const AddToDashboardModal = ({ onClose, queries, visualization }: Props) => {
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('new');
  const dispatch = useDispatch();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormDTO>({ defaultValues: { queries, visualization } });

  const onSubmit = async (data: FormDTO) => {
    try {
      const res = await addToDashboard(data);
      dispatch(notifyApp(createSuccessNotification('dashboard created')));
      onClose();

      return res.data.url;
    } catch (error) {
      switch (error.data.status) {
        case 'name-exists':
        case 'empty-name':
        case 'name-match':
          setError('dashboardName', { message: error.data.message, shouldFocus: true });
          break;
        default:
          dispatch(notifyApp(createErrorNotification(error.data.message)));
      }

      throw error.data.status;
    }
  };

  return (
    <Modal
      // TODO: we can add multiple queries, shall we change the title?
      title="Add query to dashboard"
      onDismiss={onClose}
      isOpen
    >
      <RadioButtonGroup options={options} fullWidth value={saveTarget} onChange={setSaveTarget} />

      <form>
        <input type="hidden" {...register('queries')} />
        <input type="hidden" {...register('visualization')} />

        {isSaveToNewDashboard(errors, saveTarget) ? (
          <>
            <Field label="Dashboard name" error={errors.dashboardName?.message} invalid={!!errors.dashboardName}>
              <Input
                id="dahboard_name"
                {...register('dashboardName', {
                  shouldUnregister: true,
                  required: { value: true, message: 'This field is required' },
                })}
                // we set default value here instead of in useForm because this input will be unregistered when switching
                // to "Existing Dashboard" and default values are not populated with manually registered
                // inputs (ie. when switching back to "New Dashboard")
                defaultValue="New dashboard (Explore)"
              />
            </Field>

            <Field label="Folder">
              <InputControl
                render={({ field: { ref, ...field } }) => <FolderPicker {...field} enableCreateNew inputId="folder" />}
                control={control}
                name="folder"
                shouldUnregister
              />
            </Field>
          </>
        ) : (
          <Field label="Dashboard" error={errors.dashboard?.message} invalid={!!errors.dashboard}>
            <InputControl
              // TODO: what should i pass to DashboardPicker to make it stop complaining?
              // @ts-expect-error
              render={({ field: { ref, ...field } }) => <DashboardPicker {...field} />}
              control={control}
              name="dashboard"
              shouldUnregister
              rules={{ required: { value: true, message: 'Select a dashboard to save your panel in' } }}
            />
          </Field>
        )}

        <Modal.ButtonRow>
          <Button type="reset" onClick={onClose} fill="outline" variant="secondary" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit(onSubmit)}
            variant="secondary"
            icon="compass"
            disabled={isSubmitting}
          >
            Save and keep exploring
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit(withRedirect(onSubmit))}
            variant="primary"
            icon="save"
            disabled={isSubmitting}
          >
            Save and go to dashboard
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};
