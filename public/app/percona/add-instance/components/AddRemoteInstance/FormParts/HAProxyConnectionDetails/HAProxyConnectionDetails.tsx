import React, { FC, useCallback, useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
import { MainDetailsFormPartProps } from '../FormParts.types';

export const HAProxyConnectionDetails: FC<MainDetailsFormPartProps> = ({ remoteInstanceCredentials }) => {
  const styles = useStyles2(getStyles);

  const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
  const trim = useCallback((value) => (value ? value.trim() : value), []);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.mainDetails}</h4>
      <div className={styles.group}>
        <TextInputField
          name="serviceName"
          initialValue=""
          label={Messages.form.labels.mainDetails.serviceName}
          tooltipText={Messages.form.tooltips.mainDetails.serviceName}
          placeholder={Messages.form.placeholders.mainDetails.serviceName}
        />
        <div />
      </div>
      <div className={styles.group}>
        <TextInputField
          name="address"
          initialValue=""
          label={Messages.form.labels.mainDetails.address}
          tooltipText={Messages.form.tooltips.mainDetails.address}
          placeholder={Messages.form.placeholders.mainDetails.address}
          validators={[validators.required]}
        />
        <TextInputField
          name="port"
          initialValue=""
          label={Messages.form.labels.mainDetails.port}
          tooltipText={Messages.form.tooltips.haproxy.port}
          placeholder={`Port (default: ${remoteInstanceCredentials.port} )`}
          validators={portValidators}
        />
      </div>
      <div className={styles.group}>
        <TextInputField
          name="username"
          initialValue=""
          label={Messages.form.labels.mainDetails.username}
          tooltipText={Messages.form.tooltips.haproxy.username}
          placeholder={Messages.form.placeholders.mainDetails.username}
          format={trim}
        />
        <PasswordInputField
          name="password"
          initialValue=""
          label={Messages.form.labels.mainDetails.password}
          tooltipText={Messages.form.tooltips.haproxy.password}
          placeholder={Messages.form.placeholders.mainDetails.password}
          format={trim}
        />
      </div>
    </div>
  );
};
