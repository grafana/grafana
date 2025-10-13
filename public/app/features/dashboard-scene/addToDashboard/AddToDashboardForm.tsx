import { partial } from 'lodash';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, DeepMap, FieldError, FieldErrors, useForm } from 'react-hook-form';

import { SelectableValue, TimeRange } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Panel } from '@grafana/schema';
import { Alert, Button, Field, Modal, RadioButtonGroup } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { addToDashboard, SubmissionError } from './addToDashboard';

enum SaveTarget {
  NewDashboard = 'new-dashboard',
  ExistingDashboard = 'existing-dashboard',
}

interface SaveTargetDTO {
  saveTarget: SaveTarget;
}

interface SaveToNewDashboardDTO extends SaveTargetDTO {
  saveTarget: SaveTarget.NewDashboard;
}

interface SaveToExistingDashboard extends SaveTargetDTO {
  saveTarget: SaveTarget.ExistingDashboard;
  dashboardUid: string;
}

type FormDTO = SaveToNewDashboardDTO | SaveToExistingDashboard;

export interface Props<TOptions = undefined> {
  onClose: () => void;
  buildPanel: (options: TOptions) => Panel;
  timeRange?: TimeRange;
  options: TOptions;
  children?: React.ReactNode;
}

export function AddToDashboardForm<TOptions = undefined>({
  onClose,
  buildPanel,
  timeRange,
  options,
  children,
}: Props<TOptions>): ReactElement {
  const [submissionError, setSubmissionError] = useState<SubmissionError | undefined>();
  const {
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm<FormDTO>({
    defaultValues: { saveTarget: SaveTarget.NewDashboard },
  });

  const canCreateDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
  const canWriteDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsWrite);

  const saveTargets: Array<SelectableValue<SaveTarget>> = [];

  if (canCreateDashboard) {
    saveTargets.push({
      label: 'New dashboard',
      value: SaveTarget.NewDashboard,
    });
  }

  if (canWriteDashboard) {
    saveTargets.push({
      label: 'Existing dashboard',
      value: SaveTarget.ExistingDashboard,
    });
  }

  const saveTarget = saveTargets.length > 1 ? watch('saveTarget') : saveTargets[0].value;

  const onSubmit = (openInNewTab: boolean, data: FormDTO) => {
    setSubmissionError(undefined);

    const dashboardUid = data.saveTarget === SaveTarget.ExistingDashboard ? data.dashboardUid : undefined;
    const panel = buildPanel(options);

    reportInteraction('e_2_d_submit', {
      newTab: openInNewTab,
      saveTarget: data.saveTarget,
      queries: panel.targets,
    });

    const error = addToDashboard({ dashboardUid, panel, openInNewTab, timeRange });
    if (error) {
      setSubmissionError(error);
      return;
    }

    onClose();
  };

  useEffect(() => {
    reportInteraction('e_2_d_open');
  }, []);

  return (
    <form>
      {/* For custom form options */}
      {children}

      {saveTargets.length > 1 && (
        <Controller
          control={control}
          render={({ field: { ref, ...field } }) => (
            <Field label="Target dashboard" description="Choose where to add the panel.">
              <RadioButtonGroup options={saveTargets} {...field} id="e2d-save-target" />
            </Field>
          )}
          name="saveTarget"
        />
      )}

      {saveTarget === SaveTarget.ExistingDashboard &&
        (() => {
          assertIsSaveToExistingDashboardError(errors);
          return (
            <Controller
              render={({ field: { ref, value, onChange, ...field } }) => (
                <Field
                  label="Dashboard"
                  description="Select in which dashboard the panel will be created."
                  error={errors.dashboardUid?.message}
                  invalid={!!errors.dashboardUid}
                >
                  <DashboardPicker
                    {...field}
                    inputId="e2d-dashboard-picker"
                    defaultOptions
                    onChange={(d) => onChange(d?.uid)}
                  />
                </Field>
              )}
              control={control}
              name="dashboardUid"
              shouldUnregister
              rules={{ required: { value: true, message: 'This field is required.' } }}
            />
          );
        })()}

      {submissionError && (
        <Alert severity="error" title="Error adding the panel">
          {submissionError.message}
        </Alert>
      )}

      <Modal.ButtonRow>
        <Button type="reset" onClick={onClose} fill="outline" variant="secondary">
          Cancel
        </Button>
        <Button
          type="submit"
          variant="secondary"
          onClick={handleSubmit(partial(onSubmit, true))}
          icon="external-link-alt"
        >
          Open in new tab
        </Button>
        <Button type="submit" variant="primary" onClick={handleSubmit(partial(onSubmit, false))} icon="apps">
          Open dashboard
        </Button>
      </Modal.ButtonRow>
    </form>
  );
}

function assertIsSaveToExistingDashboardError(
  errors: FieldErrors<FormDTO>
): asserts errors is DeepMap<SaveToExistingDashboard, FieldError> {
  // the shape of the errors object is always compatible with the type above, but we need to
  // explicitly assert its type so that TS can narrow down FormDTO to SaveToExistingDashboard
  // when we use it in the form.
}
