import React, { FC, useCallback, useMemo } from 'react';

import { useStyles } from '@grafana/ui';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
import { MainDetailsFormPartProps } from '../FormParts.types';

export const HAProxyConnectionDetails: FC<MainDetailsFormPartProps> = ({ remoteInstanceCredentials }) => {
  const styles = useStyles(getStyles);

  const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
  const trim = useCallback((value) => (value ? value.trim() : value), []);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.mainDetails}</h4>
      <div className={styles.labelWrapper} data-testid="address-label">
        <span>{Messages.form.labels.mainDetails.address}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.mainDetails.address} icon="info-circle" />
      </div>
      <TextInputField
        name="address"
        initialValue=""
        placeholder={Messages.form.placeholders.mainDetails.address}
        validators={[validators.required]}
      />
      <div className={styles.labelWrapper} data-testid="service-name-label">
        <span>{Messages.form.labels.mainDetails.serviceName}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.mainDetails.serviceName} icon="info-circle" />
      </div>
      <TextInputField
        name="serviceName"
        initialValue=""
        placeholder={Messages.form.placeholders.mainDetails.serviceName}
      />
      <div className={styles.labelWrapper} data-testid="port-label">
        <span>{Messages.form.labels.mainDetails.port}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.haproxy.port} icon="info-circle" />
      </div>
      <TextInputField
        name="port"
        initialValue=""
        placeholder={`Port (default: ${remoteInstanceCredentials.port} )`}
        validators={portValidators}
      />
      <div className={styles.labelWrapper} data-testid="username-label">
        <span>{Messages.form.labels.mainDetails.username}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.haproxy.username} icon="info-circle" />
      </div>
      <TextInputField
        name="username"
        initialValue=""
        placeholder={Messages.form.placeholders.mainDetails.username}
        format={trim}
      />
      <div className={styles.labelWrapper} data-testid="password-label">
        <span>{Messages.form.labels.mainDetails.password}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.haproxy.password} icon="info-circle" />
      </div>
      <PasswordInputField
        name="password"
        initialValue=""
        placeholder={Messages.form.placeholders.mainDetails.password}
        format={trim}
      />
    </div>
  );
};
