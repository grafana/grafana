import React from 'react';
import { Button, Field, InputControl, Modal, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { addPanelToDashboard } from './addToDashboard';
import { useSelector } from 'react-redux';
import { ExploreId } from 'app/types';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { DeepMap, FieldError, useForm } from 'react-hook-form';
import { css } from '@emotion/css';
import { config, locationService } from '@grafana/runtime';
import { getExploreItemSelector } from '../state/selectors';

enum SaveTarget {
  NewDashboard,
  ExistingDashboard,
}

const SAVE_TARGETS: Array<SelectableValue<SaveTarget>> = [
  {
    label: 'New Dashboard',
    value: SaveTarget.NewDashboard,
  },
  {
    label: 'Existing Dashboard',
    value: SaveTarget.ExistingDashboard,
  },
];

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

function assertIsSaveToExistingDashboardError(
  errors: DeepMap<FormDTO, FieldError>
): asserts errors is DeepMap<SaveToExistingDashboard, FieldError> {
  // the shape of the errors object is always compatible with the type above, but we need to
  // explicitly assert its type so that TS can narrow down FormDTO to SaveToExistingDashboard
  // when we use it in the form.
}

function withRedirect<T extends any[]>(fn: (redirect: boolean, ...args: T) => {}, redirect: boolean) {
  return async (...args: T) => fn(redirect, ...args);
}

function openDashboard(openInNewTab: boolean, dashboardUid?: string) {
  const url = dashboardUid ? `d/${dashboardUid}` : 'dashboard/new';

  if (!openInNewTab) {
    locationService.push(url);
  } else {
    window.open(config.appUrl + url, '_blank');
  }
}

interface Props {
  onClose: () => void;
  exploreId: ExploreId;
}

export const AddToDashboardModal = ({ onClose, exploreId }: Props) => {
  const exploreItem = useSelector(getExploreItemSelector(exploreId))!;
  const radioGroupStyles = useStyles2(
    (theme) => css`
      margin-bottom: ${theme.spacing(2)};
    `
  );
  const {
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm<FormDTO>({
    defaultValues: { saveTarget: SaveTarget.NewDashboard },
  });
  const saveTarget = watch('saveTarget');

  const onSubmit = async (openInNewTab: boolean, data: FormDTO) => {
    const dashboardUid = data.saveTarget === SaveTarget.ExistingDashboard ? data.dashboardUid : undefined;
    addPanelToDashboard({
      dashboardUid,
      exploreItem,
    });

    onClose();
    openDashboard(openInNewTab, dashboardUid);
  };

  return (
    <Modal title="Add panel to dashboard" onDismiss={onClose} isOpen>
      <form>
        <InputControl
          control={control}
          render={({ field: { ref, ...field } }) => (
            <RadioButtonGroup options={SAVE_TARGETS} {...field} className={radioGroupStyles} />
          )}
          name="saveTarget"
        />

        {saveTarget === SaveTarget.ExistingDashboard &&
          (() => {
            assertIsSaveToExistingDashboardError(errors);
            return (
              <InputControl
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

        <Modal.ButtonRow>
          <Button type="reset" onClick={onClose} fill="outline" variant="secondary">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="secondary"
            onClick={handleSubmit(withRedirect(onSubmit, true))}
            icon="external-link-alt"
          >
            Open in new tab
          </Button>
          <Button type="submit" variant="primary" onClick={handleSubmit(withRedirect(onSubmit, false))} icon="apps">
            Open
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};
