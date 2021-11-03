import React, { FC, useMemo } from 'react';
import { PasswordInputField, TextInputField, validators } from '@percona/platform-core';
import Validators from 'app/percona/shared/helpers/validators';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { useStyles } from '@grafana/ui';
import { MainDetailsFormPartProps } from '../FormParts.types';
import { getStyles } from '../FormParts.styles';
import { Messages } from '../FormParts.messages';

export const MainDetailsFormPart: FC<MainDetailsFormPartProps> = ({ form, remoteInstanceCredentials }) => {
  const styles = useStyles(getStyles);
  const formValues = form && form.getState().values;
  const tlsFlag = formValues && formValues['tls'];

  const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
  const userPassValidators = useMemo(() => (tlsFlag ? [] : [validators.required]), [tlsFlag]);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.mainDetails}</h4>
      <div className={styles.labelWrapper} data-testid="address-label">
        <span>{Messages.form.labels.mainDetails.address}</span>
        <LinkTooltip tooltipText={Messages.form.tooltips.mainDetails.address} icon="info-circle" />
      </div>
      <TextInputField
        name="address"
        placeholder={Messages.form.placeholders.mainDetails.address}
        validators={[validators.required]}
        disabled={remoteInstanceCredentials.isRDS}
      />
      <div className={styles.labelWrapper} data-testid="service-name-label">
        <span>{Messages.form.labels.mainDetails.serviceName}</span>
        <LinkTooltip tooltipText={Messages.form.tooltips.mainDetails.serviceName} icon="info-circle" />
      </div>
      <TextInputField name="serviceName" placeholder={Messages.form.placeholders.mainDetails.serviceName} />
      <div className={styles.labelWrapper} data-testid="port-label">
        <span>{Messages.form.labels.mainDetails.port}</span>
        <LinkTooltip tooltipText={Messages.form.tooltips.mainDetails.port} icon="info-circle" />
      </div>
      <TextInputField
        name="port"
        placeholder={`Port (default: ${remoteInstanceCredentials.port} )`}
        validators={portValidators}
      />
      <div className={styles.labelWrapper} data-testid="username-label">
        <span>{Messages.form.labels.mainDetails.username}</span>
        <LinkTooltip tooltipText={Messages.form.tooltips.mainDetails.username} icon="info-circle" />
      </div>
      <TextInputField
        key={`username-${tlsFlag}`}
        name="username"
        placeholder={Messages.form.placeholders.mainDetails.username}
        validators={userPassValidators}
      />
      <div className={styles.labelWrapper} data-testid="password-label">
        <span>{Messages.form.labels.mainDetails.password}</span>
        <LinkTooltip tooltipText={Messages.form.tooltips.mainDetails.password} icon="info-circle" />
      </div>
      <PasswordInputField
        key={`password-${tlsFlag}`}
        name="password"
        placeholder={Messages.form.placeholders.mainDetails.password}
        validators={userPassValidators}
      />
    </div>
  );
};
