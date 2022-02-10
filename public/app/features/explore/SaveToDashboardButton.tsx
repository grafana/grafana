import { SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Modal, ToolbarButton, RadioButtonGroup, Button, InputControl, Field, Input } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { DashboardPicker } from 'app/core/components/editors/DashboardPicker';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { createErrorNotification } from 'app/core/copy/appNotification';
import React, { useState } from 'react';
import { DeepMap, FieldError, useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { SaveToExistingDashboardDTO, SaveToNewDashboardDTO, useAddToDashboard } from './hooks/useAddToDashboard';

type SaveTarget = 'new' | 'existing';

const options: Array<SelectableValue<SaveTarget>> = [
  { label: 'New dashboard', value: 'new' },
  { label: 'Existing dashboard', value: 'existing' },
];

type FormDTO = SaveToExistingDashboardDTO | SaveToNewDashboardDTO;

const withRedirect =
  (fn: (...args: any[]) => Promise<string>) =>
  async (...args: any[]) =>
    locationService.push(await fn(...args));

// TODO: move the modal ccontent into a separate component
export const SaveToDashboardButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('new');
  const dispatch = useDispatch();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormDTO>();

  const { execute } = useAddToDashboard();

  const onSubmit = async (data: FormDTO) => {
    const res = await execute(data);

    if (!res.ok) {
      switch (res.data.status) {
        case 'name-exists':
          setError('dashboardName', { message: res.data.message, shouldFocus: true });
          break;
        // TODO: do we know of any other error from BE?
        default:
          dispatch(notifyApp(createErrorNotification(res.data.message)));
      }

      throw res.data.status;
    }

    setIsOpen(false);
    return res.data.url;
  };

  return (
    <>
      <ToolbarButton icon="apps" onClick={() => setIsOpen(true)}>
        Add to Dashboard
      </ToolbarButton>

      <Modal
        // TODO: we can add multiple queries, shall we change the title?
        title="Add query to dashboard"
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
      >
        <RadioButtonGroup options={options} fullWidth value={saveTarget} onChange={setSaveTarget} />

        <form>
          {isSaveToNewDashboard(errors, saveTarget) ? (
            <>
              <Field label="Dashboard name" error={errors.dashboardName?.message} invalid={!!errors.dashboardName}>
                <Input
                  {...register('dashboardName', {
                    shouldUnregister: true,
                    required: { value: true, message: 'This field is required' },
                  })}
                  // we set the default value here instead in useForm because this input will be unregistered when switching
                  // to "Existing Dashboard" and default values are not populated wit manually registered
                  // inputs (ie. when switching back to "New Dashboard")
                  defaultValue="New dashboard (Explore)"
                />
              </Field>

              <Field label="Folder">
                <InputControl
                  render={({ field: { ref, ...field } }) => <FolderPicker {...field} enableCreateNew />}
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
            <Button
              type="reset"
              onClick={() => setIsOpen(false)}
              fill="outline"
              variant="secondary"
              disabled={isSubmitting}
            >
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
    </>
  );
};

const isSaveToNewDashboard = (
  errors: DeepMap<FormDTO, FieldError>,
  saveTarget: SaveTarget
): errors is DeepMap<SaveToNewDashboardDTO, FieldError> => saveTarget === 'new';
