import { FC, useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
import { MainDetailsFormPartProps } from '../FormParts.types';
import { NodesAgents } from '../NodesAgents/NodesAgents';

export const PostgreSQLConnectionDetails: FC<MainDetailsFormPartProps> = ({ form, remoteInstanceCredentials }) => {
  const styles = useStyles2(getStyles);
  const formValues = form && form.getState().values;
  const tlsFlag = formValues && formValues['tls'];

  const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
  const userPassValidators = useMemo(() => (tlsFlag ? [] : [validators.required]), [tlsFlag]);
  const maxQueryLengthValidators = useMemo(() => [Validators.min(-1)], []);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.mainDetails}</h4>
      <div className={styles.group}>
        <TextInputField
          name="serviceName"
          placeholder={Messages.form.placeholders.mainDetails.serviceName}
          label={Messages.form.labels.mainDetails.serviceName}
          tooltipText={Messages.form.tooltips.mainDetails.serviceName}
        />
        {remoteInstanceCredentials.isRDS ? (
          <TextInputField
            name="instance_id"
            placeholder={Messages.form.placeholders.mainDetails.instanceID}
            label={Messages.form.labels.mainDetails.instanceID}
            tooltipText={Messages.form.tooltips.mainDetails.instanceID}
          />
        ) : (
          <div />
        )}
      </div>
      <NodesAgents form={form} />
      <div className={styles.group}>
        <TextInputField
          name="address"
          placeholder={Messages.form.placeholders.mainDetails.address}
          validators={[validators.required]}
          disabled={remoteInstanceCredentials.isRDS}
          label={Messages.form.labels.mainDetails.address}
          tooltipText={Messages.form.tooltips.mainDetails.address}
        />
        <TextInputField
          name="port"
          placeholder={`Port (default: ${remoteInstanceCredentials.port} )`}
          validators={portValidators}
          label={Messages.form.labels.mainDetails.port}
          tooltipText={Messages.form.tooltips.mainDetails.port}
        />
      </div>
      <div className={styles.group}>
        <TextInputField
          key={`username-${tlsFlag}`}
          name="username"
          placeholder={Messages.form.placeholders.mainDetails.username}
          validators={userPassValidators}
          label={Messages.form.labels.mainDetails.username}
          tooltipText={Messages.form.tooltips.mainDetails.username}
        />
        <PasswordInputField
          key={`password-${tlsFlag}`}
          name="password"
          placeholder={Messages.form.placeholders.mainDetails.password}
          validators={userPassValidators}
          label={Messages.form.labels.mainDetails.password}
          tooltipText={Messages.form.tooltips.mainDetails.password}
        />
      </div>
      <div className={styles.group}>
        <TextInputField
          key="database"
          name="database"
          placeholder={Messages.form.placeholders.postgresqlDetails.database}
          label={Messages.form.labels.postgresqlDetails.database}
          tooltipText={Messages.form.tooltips.postgresqlDetails.database}
        />
        <TextInputField
          key="maxQueryLength"
          name="maxQueryLength"
          placeholder={Messages.form.placeholders.postgresqlDetails.maxQueryLength}
          validators={maxQueryLengthValidators}
          label={Messages.form.labels.postgresqlDetails.maxQueryLength}
          tooltipText={Messages.form.tooltips.postgresqlDetails.maxQueryLength}
        />
      </div>
    </div>
  );
};
