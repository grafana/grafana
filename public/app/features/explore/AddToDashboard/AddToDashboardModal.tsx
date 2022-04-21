import React, { useEffect, useState } from 'react';
import { Alert, Button, Field, InputControl, Modal, RadioButtonGroup } from '@grafana/ui';
import { locationUtil, SelectableValue } from '@grafana/data';
import { setDashboardInLocalStorage, AddToDashboardError } from './addToDashboard';
import { useSelector } from 'react-redux';
import { ExploreId } from 'app/types';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { DeepMap, FieldError, useForm } from 'react-hook-form';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { getExploreItemSelector } from '../state/selectors';
import { partial } from 'lodash';
import { removeDashboardToFetchFromLocalStorage } from 'app/features/dashboard/state/initDashboard';

enum SaveTarget {
  NewDashboard = 'new-dashboard',
  ExistingDashboard = 'existing-dashboard',
}

const SAVE_TARGETS: Array<SelectableValue<SaveTarget>> = [
  {
    label: 'New dashboard',
    value: SaveTarget.NewDashboard,
  },
  {
    label: 'Existing dashboard',
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

function getDashboardURL(dashboardUid?: string) {
  return dashboardUid ? `d/${dashboardUid}` : 'dashboard/new';
}

enum GenericError {
  UNKNOWN = 'unknown-error',
  NAVIGATION = 'navigation-error',
}

interface SubmissionError {
  error: AddToDashboardError | GenericError;
  message: string;
}

interface Props {
  onClose: () => void;
  exploreId: ExploreId;
}

export const AddToDashboardModal = ({ onClose, exploreId }: Props) => {
  const exploreItem = useSelector(getExploreItemSelector(exploreId))!;
  const [submissionError, setSubmissionError] = useState<SubmissionError | undefined>();
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
    setSubmissionError(undefined);
    const dashboardUid = data.saveTarget === SaveTarget.ExistingDashboard ? data.dashboardUid : undefined;

    reportInteraction('e2d_submit', {
      newTab: openInNewTab,
      saveTarget: data.saveTarget,
      queries: exploreItem.queries.length,
    });

    try {
      await setDashboardInLocalStorage({
        dashboardUid,
        datasource: exploreItem.datasourceInstance?.getRef(),
        queries: exploreItem.queries,
        queryResponse: exploreItem.queryResponse,
      });
    } catch (error) {
      switch (error) {
        case AddToDashboardError.FETCH_DASHBOARD:
          setSubmissionError({ error, message: 'Could not fetch dashboard information. Please try again.' });
          break;
        case AddToDashboardError.SET_DASHBOARD_LS:
          setSubmissionError({ error, message: 'Could not add panel to dashboard. Please try again.' });
          break;
        default:
          setSubmissionError({ error: GenericError.UNKNOWN, message: 'Something went wrong. Please try again.' });
      }
      return;
    }

    const dashboardURL = getDashboardURL(dashboardUid);
    if (!openInNewTab) {
      onClose();
      locationService.push(locationUtil.stripBaseFromUrl(dashboardURL));
      return;
    }

    const didTabOpen = !!global.open(config.appUrl + dashboardURL, '_blank');
    if (!didTabOpen) {
      setSubmissionError({
        error: GenericError.NAVIGATION,
        message: 'Could not navigate to the selected dashboard. Please try again.',
      });
      removeDashboardToFetchFromLocalStorage();
      return;
    }
    onClose();
  };

  useEffect(() => {
    reportInteraction('e2d_open');
  }, []);

  return (
    <Modal title="Add panel to dashboard" onDismiss={onClose} isOpen>
      <form>
        <InputControl
          control={control}
          render={({ field: { ref, ...field } }) => (
            <Field label="Target dashboard" description="Choose where to add the panel.">
              <RadioButtonGroup options={SAVE_TARGETS} {...field} id="e2d-save-target" />
            </Field>
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
    </Modal>
  );
};
