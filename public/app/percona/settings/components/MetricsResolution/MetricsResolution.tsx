import { FormApi } from 'final-form';
import React, { FC, useEffect, useState } from 'react';
import { Form } from 'react-final-form';

import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { MetricsResolutions } from 'app/percona/settings/Settings.types';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { TabbedPage, TabbedPageContents } from 'app/percona/shared/components/TabbedPage';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import validators from 'app/percona/shared/helpers/validators';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { SET_SETTINGS_CANCEL_TOKEN } from '../../Settings.constants';
import { MAX_DAYS, MIN_DAYS } from '../Advanced/Advanced.constants';

import { defaultResolutions, resolutionsOptions } from './MetricsResolution.constants';
import { getStyles } from './MetricsResolution.styles';
import { MetricsResolutionIntervals, MetricsResolutionPresets } from './MetricsResolution.types';
import { addUnits, getResolutionValue, removeUnits } from './MetricsResolution.utils';

export const MetricsResolution: FC = () => {
  const styles = useStyles2(getStyles);
  const settingsStyles = useStyles2(getSettingsStyles);
  const [initialValues, setInitialValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [generateToken] = useCancelToken();
  const { result: settings } = useSelector(getPerconaSettings);
  const dispatch = useAppDispatch();
  const { metricsResolutions } = settings!;
  const [resolution, setResolution] = useState(getResolutionValue(metricsResolutions).value);
  const [fieldsResolutions, updateFieldsResolutions] = useState(removeUnits(metricsResolutions));
  const [customResolutions, updateCustomResolutions] = useState(fieldsResolutions);

  useEffect(() => {
    setInitialValues({ ...removeUnits(metricsResolutions), resolutions: getResolutionValue(metricsResolutions).value });
  }, [metricsResolutions]);

  const {
    metrics: {
      action,
      label,
      link,
      tooltip,
      intervals: { low, medium, high },
    },
    tooltipLinkText,
  } = Messages;
  const resolutionValidators = [validators.required, validators.range(MIN_DAYS, MAX_DAYS)];

  const applyChanges = async (values: MetricsResolutions) => {
    setLoading(true);
    await dispatch(
      updateSettingsAction({
        body: { metrics_resolutions: addUnits(values) },
        token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
      })
    );
    setLoading(false);
  };

  const updateResolutions = (
    form: FormApi<{ hr: string; mr: string; lr: string; resolutions: MetricsResolutionPresets }>
  ) => {
    const { hr, mr, lr, resolutions: newResolution } = form.getState().values;

    if (resolution === newResolution) {
      return;
    }

    if (resolution === MetricsResolutionPresets.custom) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      updateCustomResolutions({ hr, mr, lr } as MetricsResolutions);
    }

    if (newResolution !== MetricsResolutionPresets.custom) {
      const newResolutionKey = resolutionsOptions.findIndex((r) => r.value === newResolution);
      const resolutions = removeUnits(defaultResolutions[newResolutionKey]);

      updateFieldsResolutions(resolutions);
      form.change(MetricsResolutionIntervals.lr, resolutions.lr);
      form.change(MetricsResolutionIntervals.mr, resolutions.mr);
      form.change(MetricsResolutionIntervals.hr, resolutions.hr);
    } else {
      updateFieldsResolutions(customResolutions);
      form.change(MetricsResolutionIntervals.lr, customResolutions.lr);
      form.change(MetricsResolutionIntervals.mr, customResolutions.mr);
      form.change(MetricsResolutionIntervals.hr, customResolutions.hr);
    }

    setResolution(newResolution);
  };

  return (
    <TabbedPage navId="settings-metrics-resolution" vertical>
      <TabbedPageContents dataTestId="settings-tab-content" className={settingsStyles.pageContent}>
        <FeatureLoader>
          <div className={styles.resolutionsWrapper}>
            <Form
              onSubmit={applyChanges}
              initialValues={initialValues}
              render={({ form, handleSubmit, valid, pristine }) => (
                <form
                  onSubmit={handleSubmit}
                  // @ts-ignore
                  onChange={() => updateResolutions(form)}
                  data-testid="metrics-resolution-form"
                >
                  <div className={settingsStyles.labelWrapper} data-testid="metrics-resolution-label">
                    <span>{label}</span>
                    <LinkTooltip tooltipContent={tooltip} link={link} linkText={tooltipLinkText} icon="info-circle" />
                  </div>
                  <RadioButtonGroupField
                    name="resolutions"
                    data-testid="metrics-resolution-radio-button-group"
                    options={resolutionsOptions}
                  />
                  <div className={styles.numericFieldWrapper}>
                    <NumberInputField
                      label={low}
                      name={MetricsResolutionIntervals.lr}
                      disabled={resolution !== MetricsResolutionPresets.custom}
                      data-testid="metrics-resolution-lr-input"
                      validators={resolutionValidators}
                    />
                  </div>
                  <div className={styles.numericFieldWrapper}>
                    <NumberInputField
                      label={medium}
                      name={MetricsResolutionIntervals.mr}
                      disabled={resolution !== MetricsResolutionPresets.custom}
                      data-testid="metrics-resolution-mr-input"
                      validators={resolutionValidators}
                    />
                  </div>
                  <div className={styles.numericFieldWrapper}>
                    <NumberInputField
                      label={high}
                      name={MetricsResolutionIntervals.hr}
                      disabled={resolution !== MetricsResolutionPresets.custom}
                      data-testid="metrics-resolution-hr-input"
                      validators={resolutionValidators}
                    />
                  </div>
                  <Button
                    className={settingsStyles.actionButton}
                    type="submit"
                    disabled={!valid || pristine || loading}
                    data-testid="metrics-resolution-button"
                  >
                    {loading && <Spinner />}
                    {action}
                  </Button>
                </form>
              )}
            />
          </div>
        </FeatureLoader>
      </TabbedPageContents>
    </TabbedPage>
  );
};

export default MetricsResolution;
