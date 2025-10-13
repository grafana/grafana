import { FC, useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';
import { NodesAgents } from 'app/percona/add-instance/components/AddRemoteInstance/FormParts/NodesAgents/NodesAgents';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
import { MainDetailsFormPartProps } from '../FormParts.types';

export const MainDetailsFormPart: FC<MainDetailsFormPartProps> = ({ form, remoteInstanceCredentials }) => {
  const styles = useStyles2(getStyles);
  const formValues = form && form.getState().values;
  const tlsFlag = formValues && formValues['tls'];

  const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
  const userPassValidators = useMemo(() => (tlsFlag ? [] : [validators.required]), [tlsFlag]);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.mainDetails}</h4>
      <div className={styles.group}>
        <TextInputField
          name="serviceName"
          label={Messages.form.labels.mainDetails.serviceName}
          tooltipText={Messages.form.tooltips.mainDetails.serviceName}
          placeholder={Messages.form.placeholders.mainDetails.serviceName}
        />
        <div />
      </div>
      <NodesAgents form={form} />
      <div className={styles.group}>
        <TextInputField
          name="address"
          label={Messages.form.labels.mainDetails.address}
          tooltipText={Messages.form.tooltips.mainDetails.address}
          placeholder={Messages.form.placeholders.mainDetails.address}
          validators={[validators.required]}
          disabled={remoteInstanceCredentials.isRDS}
        />
        <TextInputField
          name="port"
          label={Messages.form.labels.mainDetails.port}
          tooltipText={Messages.form.tooltips.mainDetails.port}
          placeholder={`Port (default: ${remoteInstanceCredentials.port} )`}
          validators={portValidators}
        />
      </div>
      <div className={styles.group}>
        <TextInputField
          key={`username-${tlsFlag}`}
          name="username"
          label={Messages.form.labels.mainDetails.username}
          tooltipText={Messages.form.tooltips.mainDetails.username}
          placeholder={Messages.form.placeholders.mainDetails.username}
          validators={userPassValidators}
        />
        <PasswordInputField
          key={`password-${tlsFlag}`}
          name="password"
          label={Messages.form.labels.mainDetails.password}
          tooltipText={Messages.form.tooltips.mainDetails.password}
          placeholder={Messages.form.placeholders.mainDetails.password}
          validators={userPassValidators}
        />
      </div>
    </div>
  );
};
