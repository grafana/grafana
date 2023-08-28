import React, { FC, useCallback, useEffect, useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { metricsParametersOptions, schemaOptions } from '../FormParts.constants';
import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
import { FormPartProps, MetricsParameters, Schema } from '../FormParts.types';

export const ExternalServiceConnectionDetails: FC<FormPartProps> = ({ form }) => {
  const styles = useStyles2(getStyles);
  const formValues = form.getState().values;
  const selectedOption = formValues?.metricsParameters;
  const urlValue = formValues?.url;
  const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);

  const trim = useCallback((value) => (value ? value.trim() : value), []);
  const getUrlParts = () => {
    try {
      const url = new URL(form.getState().values.url);
      const protocol = url.protocol.replace(':', '');

      form.mutators?.setValue('schema', protocol);
      form.mutators?.setValue('address', url.hostname);
      form.mutators?.setValue('port', url.port || (protocol === 'https' ? '443' : '80'));
      form.mutators?.setValue('metrics_path', url.pathname);
      form.mutators?.setValue('username', url.username);
      form.mutators?.setValue('password', url.password);
    } catch (e) {
      form.mutators?.setValue('schema', Schema.HTTPS);
      form.mutators?.setValue('address', '');
      form.mutators?.setValue('port', '443');
      form.mutators?.setValue('metrics_path', '');
      form.mutators?.setValue('username', '');
      form.mutators?.setValue('password', '');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(getUrlParts, [urlValue]);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.connectionDetails}</h4>
      <div className={styles.group}>
        <TextInputField
          name="serviceName"
          label={Messages.form.labels.externalService.serviceName}
          tooltipText={Messages.form.tooltips.externalService.serviceName}
          placeholder={Messages.form.placeholders.externalService.serviceName}
        />
        <div />
      </div>
      <div className={styles.group}>
        <TextInputField
          name="group"
          label={Messages.form.labels.externalService.group}
          tooltipText={Messages.form.tooltips.externalService.group}
        />
        <div />
      </div>
      <div className={styles.group}>
        <RadioButtonGroupField
          name="metricsParameters"
          data-testid="metrics-parameters-field"
          label={Messages.form.labels.externalService.connectionParameters}
          tooltipText={Messages.form.tooltips.externalService.url}
          options={metricsParametersOptions}
        />
      </div>
      {selectedOption === MetricsParameters.parsed && (
        <div className={styles.urlFieldWrapper}>
          <TextInputField
            name="url"
            label={Messages.form.labels.externalService.url}
            tooltipText={Messages.form.tooltips.externalService.url}
            placeholder={Messages.form.placeholders.externalService.url}
            validators={[Validators.validateUrl, validators.required]}
          />
        </div>
      )}
      {selectedOption === MetricsParameters.manually && (
        <>
          <div className={styles.group}>
            <RadioButtonGroupField
              name="schema"
              data-testid="http-schema-field"
              label={Messages.form.labels.externalService.schema}
              tooltipText={Messages.form.tooltips.externalService.schema}
              options={schemaOptions}
            />
            <div />
          </div>
          <div className={styles.group}>
            <TextInputField
              name="address"
              initialValue=""
              label={Messages.form.labels.externalService.address}
              tooltipText={Messages.form.tooltips.externalService.address}
              placeholder={Messages.form.placeholders.externalService.address}
              validators={[validators.required]}
            />
            <TextInputField
              name="metrics_path"
              initialValue=""
              label={Messages.form.labels.externalService.metricsPath}
              tooltipText={Messages.form.tooltips.externalService.metricsPath}
              placeholder={Messages.form.placeholders.externalService.metricsPath}
            />
          </div>
          <div className={styles.group}>
            <TextInputField
              name="port"
              placeholder="Port"
              label={Messages.form.labels.externalService.port}
              tooltipText={Messages.form.tooltips.externalService.port}
              validators={portValidators}
            />
            <div />
          </div>
          <div className={styles.group}>
            <TextInputField
              name="username"
              initialValue=""
              label={Messages.form.labels.externalService.username}
              tooltipText={Messages.form.tooltips.externalService.username}
              placeholder={Messages.form.placeholders.externalService.username}
              format={trim}
            />
            <PasswordInputField
              name="password"
              initialValue=""
              label={Messages.form.labels.externalService.password}
              tooltipText={Messages.form.tooltips.externalService.password}
              placeholder={Messages.form.placeholders.externalService.password}
              format={trim}
            />
          </div>
        </>
      )}
    </div>
  );
};
