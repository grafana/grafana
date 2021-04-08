import React, { FC, useState } from 'react';
import { Field, withTypes } from 'react-final-form';
import { cx } from 'emotion';
import { Button, Spinner, useTheme, Icon } from '@grafana/ui';
import { TextInputField, NumberInputField } from '@percona/platform-core';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { Messages } from 'app/percona/settings/Settings.messages';
import { DATA_RETENTION_URL } from 'app/percona/settings/Settings.constants';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import validators from 'app/percona/shared/helpers/validators';
import { getStyles } from './Advanced.styles';
import { transformSecondsToDays } from './Advanced.utils';
import { SECONDS_IN_DAY, MIN_DAYS, MAX_DAYS, TECHNICAL_PREVIEW_DOC_URL } from './Advanced.constants';
import { AdvancedProps, AdvancedFormProps } from './Advanced.types';
import { SwitchRow } from './SwitchRow';
import { AdvancedChangePayload } from '../../Settings.types';

const refreshingFeatureKeys: Array<keyof AdvancedFormProps> = ['alerting', 'backup', 'stt'];

export const Advanced: FC<AdvancedProps> = ({
  dataRetention,
  telemetryEnabled,
  backupEnabled,
  updatesDisabled,
  sttEnabled,
  dbaasEnabled,
  alertingEnabled,
  azureDiscoverEnabled,
  publicAddress,
  updateSettings,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const settingsStyles = getSettingsStyles(theme);
  const {
    advanced: {
      action,
      retentionLabel,
      retentionTooltip,
      retentionUnits,
      telemetryLabel,
      telemetryLink,
      telemetryTooltip,
      updatesLabel,
      updatesLink,
      updatesTooltip,
      sttLabel,
      sttLink,
      sttTooltip,
      dbaasLabel,
      dbaasTooltip,
      publicAddressLabel,
      publicAddressTooltip,
      publicAddressButton,
      alertingLabel,
      alertingTooltip,
      alertingLink,
      azureDiscoverLabel,
      azureDiscoverTooltip,
      azureDiscoverLink,
      technicalPreviewLegend,
      technicalPreviewDescription,
      technicalPreviewLinkText,
    },
    tooltipLinkText,
  } = Messages;
  const initialValues: AdvancedFormProps = {
    retention: transformSecondsToDays(dataRetention),
    telemetry: telemetryEnabled,
    updates: !updatesDisabled,
    backup: backupEnabled,
    stt: sttEnabled,
    dbaas: dbaasEnabled,
    azureDiscover: azureDiscoverEnabled,
    publicAddress,
    alerting: alertingEnabled,
  };
  const [loading, setLoading] = useState(false);
  // @ts-ignore
  const applyChanges = (values: AdvancedFormProps) => {
    const { retention, telemetry, stt, publicAddress, alerting, backup, azureDiscover } = values;
    const refresh = !!refreshingFeatureKeys.find(feature => !!values[feature] !== initialValues[feature]);
    const body: AdvancedChangePayload = {
      data_retention: `${+retention * SECONDS_IN_DAY}s`,
      disable_telemetry: !telemetry,
      enable_telemetry: telemetry,
      disable_stt: !stt,
      enable_stt: stt,
      disable_azurediscover: !azureDiscover,
      enable_azurediscover: azureDiscover,
      pmm_public_address: publicAddress,
      remove_pmm_public_address: !publicAddress,
      enable_alerting: alerting ? true : undefined,
      disable_alerting: !alerting ? true : undefined,
      enable_backup_management: backup,
      disable_backup_management: !backup,
    };

    updateSettings(body, setLoading, refresh);
  };
  const { Form } = withTypes<AdvancedFormProps>();

  return (
    <div className={styles.advancedWrapper}>
      <Form
        onSubmit={applyChanges}
        initialValues={initialValues}
        render={({ form: { change }, values, handleSubmit, valid, pristine }) => (
          <form onSubmit={handleSubmit}>
            <div className={styles.advancedRow}>
              <div className={styles.advancedCol}>
                <div className={settingsStyles.labelWrapper} data-qa="advanced-label">
                  <span>{retentionLabel}</span>
                  <LinkTooltip
                    tooltipText={retentionTooltip}
                    link={DATA_RETENTION_URL}
                    linkText={tooltipLinkText}
                    icon="info-circle"
                  />
                </div>
              </div>
              <div className={styles.retentionInputWrapper}>
                <NumberInputField
                  name="retention"
                  validators={[validators.required, validators.range(MIN_DAYS, MAX_DAYS)]}
                />
              </div>
              <span className={styles.retentionUnitslabel}>{retentionUnits}</span>
            </div>
            <Field
              name="telemetry"
              type="checkbox"
              label={telemetryLabel}
              tooltip={telemetryTooltip}
              tooltipLinkText={tooltipLinkText}
              link={telemetryLink}
              className={cx({ [styles.switchDisabled]: values.stt || values.alerting })}
              disabled={values.stt || values.alerting}
              dataQa="advanced-telemetry"
              component={SwitchRow}
            />
            <Field
              name="stt"
              type="checkbox"
              label={sttLabel}
              tooltip={sttTooltip}
              tooltipLinkText={tooltipLinkText}
              link={sttLink}
              className={cx({ [styles.switchDisabled]: !values.telemetry })}
              disabled={!values.telemetry}
              dataQa="advanced-stt"
              component={SwitchRow}
            />
            <Field
              name="updates"
              type="checkbox"
              label={updatesLabel}
              tooltip={updatesTooltip}
              tooltipLinkText={tooltipLinkText}
              link={updatesLink}
              className={styles.switchDisabled}
              disabled
              dataQa="advanced-updates"
              component={SwitchRow}
            />
            {/* TODO remove comment when feature is ready to come out */}
            {/* <Field
              name="backup"
              type="checkbox"
              label={backupLabel}
              tooltip={backupTooltip}
              tooltipLinkText={tooltipLinkText}
              link={backupLink}
              className={cx({ [styles.switchDisabled]: !values.backup })}
              disabled={!values.telemetry}
              dataQa="advanced-backup"
              component={SwitchRow}
            /> */}
            <div className={styles.advancedRow}>
              <div className={cx(styles.advancedCol, styles.publicAddressLabelWrapper)}>
                <div className={settingsStyles.labelWrapper} data-qa="public-address-label">
                  <span>{publicAddressLabel}</span>
                  <LinkTooltip tooltipText={publicAddressTooltip} icon="info-circle" />
                </div>
              </div>
              <div className={styles.publicAddressWrapper}>
                <TextInputField name="publicAddress" className={styles.publicAddressInput} />
                <Button
                  className={styles.publicAddressButton}
                  type="button"
                  variant="secondary"
                  data-qa="public-address-button"
                  onClick={() => change('publicAddress', window.location.hostname)}
                >
                  <Icon name="link" />
                  {publicAddressButton}
                </Button>
              </div>
            </div>
            <fieldset className={styles.technicalPreview}>
              <legend>{technicalPreviewLegend}</legend>
              <p className={styles.technicalPreviewDoc}>
                <Icon name="info-circle" size={'xl'} className={styles.technicalPreviewIcon} />
                <p>
                  {technicalPreviewDescription}{' '}
                  <a href={TECHNICAL_PREVIEW_DOC_URL} target="_blank">
                    {technicalPreviewLinkText}
                  </a>
                </p>
              </p>
              {dbaasEnabled && (
                <Field
                  name="dbaas"
                  type="checkbox"
                  label={dbaasLabel}
                  tooltip={dbaasTooltip}
                  className={styles.switchDisabled}
                  disabled
                  dataQa="advanced-dbaas"
                  component={SwitchRow}
                />
              )}
              <Field
                name="alerting"
                type="checkbox"
                label={alertingLabel}
                tooltip={alertingTooltip}
                tooltipLinkText={tooltipLinkText}
                link={alertingLink}
                className={cx({ [styles.switchDisabled]: !values.telemetry })}
                disabled={!values.telemetry}
                dataQa="advanced-alerting"
                component={SwitchRow}
              />
              <Field
                name="azureDiscover"
                type="checkbox"
                label={azureDiscoverLabel}
                tooltip={azureDiscoverTooltip}
                tooltipLinkText={tooltipLinkText}
                link={azureDiscoverLink}
                dataQa="advanced-azure-discover"
                component={SwitchRow}
              />
            </fieldset>
            <Button
              className={settingsStyles.actionButton}
              type="submit"
              disabled={!valid || pristine || loading}
              data-qa="advanced-button"
            >
              {loading && <Spinner />}
              {action}
            </Button>
          </form>
        )}
      />
    </div>
  );
};
