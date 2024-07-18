import { cx } from '@emotion/css';
import React, { FC, useState } from 'react';
import { Field, withTypes } from 'react-final-form';

import { Button, Icon, Spinner, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import validators from 'app/percona/shared/helpers/validators';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { SET_SETTINGS_CANCEL_TOKEN } from '../../Settings.constants';
import { AdvancedChangePayload } from '../../Settings.types';

import {
  MAX_DAYS,
  MIN_DAYS,
  MIN_STT_CHECK_INTERVAL,
  SECONDS_IN_DAY,
  STT_CHECK_INTERVALS,
  STT_CHECK_INTERVAL_STEP,
  TECHNICAL_PREVIEW_DOC_URL,
} from './Advanced.constants';
import { getStyles } from './Advanced.styles';
import { AdvancedFormProps } from './Advanced.types';
import { convertCheckIntervalsToHours, convertHoursStringToSeconds, convertSecondsToDays } from './Advanced.utils';
import { SwitchRow } from './SwitchRow';

const {
  advanced: { sttCheckIntervalsLabel, sttCheckIntervalTooltip, sttCheckIntervalUnit },
} = Messages;

export const Advanced: FC = () => {
  const styles = useStyles2(getStyles);
  const [generateToken] = useCancelToken();
  const { result: settings } = useSelector(getPerconaSettings);
  const dispatch = useAppDispatch();
  const {
    advisorRunIntervals: sttCheckIntervals,
    dataRetention,
    telemetryEnabled,
    updatesEnabled,
    backupEnabled,
    advisorEnabled: sttEnabled,
    azureDiscoverEnabled,
    publicAddress,
    alertingEnabled,
    telemetrySummaries,
    enableAccessControl,
  } = settings!;
  const settingsStyles = useStyles2(getSettingsStyles);
  const { rareInterval, standardInterval, frequentInterval } = convertCheckIntervalsToHours(sttCheckIntervals);
  const {
    advanced: {
      action,
      retentionLabel,
      retentionTooltip,
      retentionUnits,
      telemetryLabel,
      telemetryLink,
      telemetryTooltip,
      telemetrySummaryTitle,
      telemetryDisclaimer,
      updatesLabel,
      updatesLink,
      updatesTooltip,
      advisorsLabel,
      advisorsLink,
      advisorsTooltip,
      publicAddressLabel,
      publicAddressTooltip,
      publicAddressButton,
      accessControl,
      accessControlTooltip,
      accessControlLink,
      alertingLabel,
      alertingTooltip,
      alertingLink,
      azureDiscoverLabel,
      azureDiscoverTooltip,
      azureDiscoverLink,
      technicalPreviewLegend,
      technicalPreviewDescription,
      technicalPreviewLinkText,
      backupLabel,
      backupLink,
      backupTooltip,
    },
    tooltipLinkText,
  } = Messages;

  const initialValues: AdvancedFormProps = {
    retention: convertSecondsToDays(dataRetention),
    telemetry: telemetryEnabled,
    updates: updatesEnabled,
    backup: backupEnabled,
    stt: sttEnabled,
    azureDiscover: azureDiscoverEnabled,
    publicAddress,
    alerting: alertingEnabled,
    rareInterval,
    standardInterval,
    frequentInterval,
    telemetrySummaries,
    accessControl: enableAccessControl,
  };
  const [loading, setLoading] = useState(false);

  const applyChanges = async (values: AdvancedFormProps) => {
    const {
      retention,
      telemetry,
      stt,
      publicAddress,
      alerting,
      backup,
      azureDiscover,
      rareInterval,
      standardInterval,
      frequentInterval,
      updates,
      accessControl,
    } = values;
    const sttCheckIntervals = {
      rare_interval: `${convertHoursStringToSeconds(rareInterval)}s`,
      standard_interval: `${convertHoursStringToSeconds(standardInterval)}s`,
      frequent_interval: `${convertHoursStringToSeconds(frequentInterval)}s`,
    };

    const body: AdvancedChangePayload = {
      data_retention: `${+retention * SECONDS_IN_DAY}s`,
      enable_telemetry: telemetry,
      enable_advisor: stt,
      enable_azurediscover: azureDiscover,
      pmm_public_address: publicAddress,
      enable_alerting: alerting,
      advisor_run_intervals: !!stt ? sttCheckIntervals : undefined,
      enable_backup_management: backup,
      enable_updates: updates,
      enable_access_control: accessControl,
    };

    setLoading(true);
    await dispatch(
      updateSettingsAction({
        body,
        token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
      })
    );
    setLoading(false);
  };
  const { Form } = withTypes<AdvancedFormProps>();

  return (
    <Page navId="settings-advanced">
      <Page.Contents dataTestId="settings-tab-content" className={settingsStyles.pageContent}>
        <FeatureLoader>
          <div className={styles.advancedWrapper}>
            <Form
              onSubmit={applyChanges}
              initialValues={initialValues}
              mutators={{
                setPublicAddress: ([publicAddressValue], state, { changeValue }) => {
                  if (!state?.lastFormState?.values['publicAddress']) {
                    changeValue(state, 'publicAddress', () => publicAddressValue);
                  }
                },
              }}
              render={({ form: { change, mutators }, values, handleSubmit, valid, pristine }) => (
                <form onSubmit={handleSubmit}>
                  <div className={styles.advancedRow}>
                    <div className={styles.advancedCol}>
                      <div className={settingsStyles.labelWrapper} data-testid="advanced-label">
                        <span>{retentionLabel}</span>
                        <LinkTooltip
                          tooltipContent={retentionTooltip}
                          link={Messages.advanced.retentionLink}
                          linkText={tooltipLinkText}
                          icon="info-circle"
                        />
                      </div>
                    </div>
                    <div className={styles.inputWrapper}>
                      <NumberInputField
                        name="retention"
                        validators={[validators.required, validators.range(MIN_DAYS, MAX_DAYS)]}
                      />
                    </div>
                    <span className={styles.unitsLabel}>{retentionUnits}</span>
                  </div>
                  <Field
                    name="telemetry"
                    type="checkbox"
                    label={telemetryLabel}
                    tooltip={
                      <TelemetryTooltip
                        telemetryTooltip={telemetryTooltip}
                        telemetrySummaryTitle={telemetrySummaryTitle}
                        telemetrySummaries={telemetrySummaries}
                      />
                    }
                    tooltipLinkText={tooltipLinkText}
                    link={telemetryLink}
                    dataTestId="advanced-telemetry"
                    component={SwitchRow}
                  />
                  <div className={styles.infoBox}>
                    <Icon name="info-circle" size="xl" className={styles.infoBoxIcon} />
                    <p>{telemetryDisclaimer}</p>
                  </div>
                  <Field
                    name="updates"
                    type="checkbox"
                    label={updatesLabel}
                    tooltip={updatesTooltip}
                    tooltipLinkText={tooltipLinkText}
                    link={updatesLink}
                    dataTestId="advanced-updates"
                    component={SwitchRow}
                  />
                  <Field
                    name="stt"
                    type="checkbox"
                    label={advisorsLabel}
                    tooltip={advisorsTooltip}
                    tooltipLinkText={tooltipLinkText}
                    link={advisorsLink}
                    dataTestId="advanced-advisors"
                    component={SwitchRow}
                  />
                  <Field
                    name="alerting"
                    type="checkbox"
                    label={alertingLabel}
                    tooltip={alertingTooltip}
                    tooltipLinkText={tooltipLinkText}
                    link={alertingLink}
                    dataTestId="advanced-alerting"
                    component={SwitchRow}
                  />
                  <Field
                    name="backup"
                    type="checkbox"
                    label={backupLabel}
                    tooltip={backupTooltip}
                    tooltipLinkText={tooltipLinkText}
                    link={backupLink}
                    dataTestId="advanced-backup"
                    component={SwitchRow}
                  />
                  <div className={styles.advancedRow}>
                    <div className={cx(styles.advancedCol, styles.publicAddressLabelWrapper)}>
                      <div className={settingsStyles.labelWrapper} data-testid="public-address-label">
                        <span>{publicAddressLabel}</span>
                        <LinkTooltip tooltipContent={publicAddressTooltip} icon="info-circle" />
                      </div>
                    </div>
                    <div className={styles.publicAddressWrapper}>
                      <TextInputField name="publicAddress" className={styles.publicAddressInput} />
                      <Button
                        className={styles.publicAddressButton}
                        type="button"
                        variant="secondary"
                        data-testid="public-address-button"
                        onClick={() => change('publicAddress', window.location.host)}
                      >
                        <Icon name="link" />
                        {publicAddressButton}
                      </Button>
                    </div>
                  </div>
                  <div className={styles.advancedRow}>
                    <div className={cx(styles.advancedCol, styles.advancedChildCol, styles.sttCheckIntervalsLabel)}>
                      <div className={settingsStyles.labelWrapper} data-testid="check-intervals-label">
                        <span>{sttCheckIntervalsLabel}</span>
                        <LinkTooltip tooltipContent={sttCheckIntervalTooltip} icon="info-circle" />
                      </div>
                    </div>
                  </div>
                  {STT_CHECK_INTERVALS.map(({ label, name }) => (
                    <div key={name} className={styles.advancedRow}>
                      <div className={cx(styles.advancedCol, styles.advancedChildCol)}>
                        <div className={settingsStyles.labelWrapper} data-testid={`check-interval-${name}-label`}>
                          <span>{label}</span>
                        </div>
                      </div>
                      <div className={styles.inputWrapper}>
                        <NumberInputField
                          inputProps={{ step: STT_CHECK_INTERVAL_STEP, min: MIN_STT_CHECK_INTERVAL }}
                          disabled={!values.stt}
                          name={name}
                          validators={[validators.required, validators.min(MIN_STT_CHECK_INTERVAL)]}
                        />
                      </div>
                      <span className={styles.unitsLabel}>{sttCheckIntervalUnit}</span>
                    </div>
                  ))}
                  <fieldset className={styles.technicalPreview}>
                    <legend>{technicalPreviewLegend}</legend>
                    <div className={styles.infoBox}>
                      <Icon name="info-circle" size="xl" className={styles.infoBoxIcon} />
                      <p>
                        {technicalPreviewDescription}{' '}
                        <a href={TECHNICAL_PREVIEW_DOC_URL} target="_blank" rel="noreferrer">
                          {technicalPreviewLinkText}
                        </a>
                      </p>
                    </div>
                    <Field
                      name="azureDiscover"
                      type="checkbox"
                      label={azureDiscoverLabel}
                      tooltip={azureDiscoverTooltip}
                      tooltipLinkText={tooltipLinkText}
                      link={azureDiscoverLink}
                      dataTestId="advanced-azure-discover"
                      component={SwitchRow}
                    />
                    <Field
                      name="accessControl"
                      type="checkbox"
                      label={accessControl}
                      tooltip={accessControlTooltip}
                      tooltipLinkText={tooltipLinkText}
                      link={accessControlLink}
                      dataTestId="access-control"
                      component={SwitchRow}
                    />
                  </fieldset>
                  <Button
                    className={settingsStyles.actionButton}
                    type="submit"
                    disabled={!valid || pristine || loading}
                    data-testid="advanced-button"
                  >
                    {loading && <Spinner />}
                    {action}
                  </Button>
                </form>
              )}
            />
          </div>
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

interface TelemetryTooltipProps {
  telemetryTooltip: string;
  telemetrySummaryTitle: string;
  telemetrySummaries: string[];
}

const TelemetryTooltip: FC<TelemetryTooltipProps> = ({
  telemetryTooltip,
  telemetrySummaryTitle,
  telemetrySummaries,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.telemetryTooltip} data-testid="info-tooltip">
      <p>{telemetryTooltip}</p>
      <p>{telemetrySummaryTitle}</p>
      <ul className={styles.telemetryListTooltip}>
        {telemetrySummaries.map((summary) => (
          <li key={summary}>{summary}</li>
        ))}
      </ul>
    </div>
  );
};

export default Advanced;
