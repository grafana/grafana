import React, { FC, useMemo } from 'react';

import { useStyles } from '@grafana/ui';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
import { MainDetailsFormPartProps } from '../FormParts.types';

export const MongoDBConnectionDetails: FC<MainDetailsFormPartProps> = ({ form, remoteInstanceCredentials }) => {
  const styles = useStyles(getStyles);
  const formValues = form && form.getState().values;
  const tlsFlag = formValues && formValues['tls'];

  const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
  const userPassValidators = useMemo(() => (tlsFlag ? [] : [validators.required]), [tlsFlag]);
  const maxQueryLengthValidators = useMemo(() => [Validators.min(-1)], []);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.mainDetails}</h4>
      <div className={styles.labelWrapper} data-testid="address-label">
        <span>{Messages.form.labels.mainDetails.address}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.mainDetails.address} icon="info-circle" />
      </div>
      <TextInputField
        name="address"
        placeholder={Messages.form.placeholders.mainDetails.address}
        validators={[validators.required]}
        disabled={remoteInstanceCredentials.isRDS}
      />
      <div className={styles.labelWrapper} data-testid="service-name-label">
        <span>{Messages.form.labels.mainDetails.serviceName}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.mainDetails.serviceName} icon="info-circle" />
      </div>
      <TextInputField name="serviceName" placeholder={Messages.form.placeholders.mainDetails.serviceName} />
      <div className={styles.labelWrapper} data-testid="port-label">
        <span>{Messages.form.labels.mainDetails.port}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.mainDetails.port} icon="info-circle" />
      </div>
      <TextInputField
        name="port"
        placeholder={`Port (default: ${remoteInstanceCredentials.port} )`}
        validators={portValidators}
      />
      <div className={styles.labelWrapper} data-testid="username-label">
        <span>{Messages.form.labels.mainDetails.username}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.mainDetails.username} icon="info-circle" />
      </div>
      <TextInputField
        key={`username-${tlsFlag}`}
        name="username"
        placeholder={Messages.form.placeholders.mainDetails.username}
        validators={userPassValidators}
      />
      <div className={styles.labelWrapper} data-testid="password-label">
        <span>{Messages.form.labels.mainDetails.password}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.mainDetails.password} icon="info-circle" />
      </div>
      <PasswordInputField
        key={`password-${tlsFlag}`}
        name="password"
        placeholder={Messages.form.placeholders.mainDetails.password}
        validators={userPassValidators}
      />
      <div className={styles.labelWrapper} data-testid="max-query-length-label">
        <span>{Messages.form.labels.mongodbDetails.maxQueryLength}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.mongodbDetails.maxQueryLength} icon="info-circle" />
      </div>
      <TextInputField
        key="maxQueryLength"
        name="maxQueryLength"
        placeholder={Messages.form.placeholders.mongodbDetails.maxQueryLength}
        validators={maxQueryLengthValidators}
      />
    </div>
  );
};
