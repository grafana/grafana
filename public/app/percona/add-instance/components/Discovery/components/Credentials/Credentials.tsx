import React, { FC, useCallback } from 'react';
import { Form as FormFinal } from 'react-final-form';

import { useStyles } from '@grafana/ui';
import { ADD_INSTANCE_FORM_NAME } from 'app/percona/add-instance/panel.constants';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';

import { Messages } from './Credentials.messages';
import { getStyles } from './Credentials.styles';
import { CredentialsProps, RDSCredentialsForm } from './Credentials.types';

const Credentials: FC<CredentialsProps> = ({ discover }) => {
  const styles = useStyles(getStyles);

  const onSubmit = useCallback(
    (values: RDSCredentialsForm) => {
      discover(values);
    },
    [discover]
  );

  return (
    <FormFinal
      onSubmit={onSubmit}
      render={({ handleSubmit }) => (
        <form
          id={ADD_INSTANCE_FORM_NAME}
          onSubmit={handleSubmit}
          className={styles.instanceForm}
          data-testid="credentials-form"
        >
          <div className={styles.fieldsWrapper}>
            <TextInputField
              name={Messages.form.fields.awsAccessKey.name}
              placeholder={Messages.form.fields.awsAccessKey.placeholder}
              label={Messages.form.fields.awsAccessKey.label}
              fieldClassName={styles.credentialsField}
            />
            <PasswordInputField
              name={Messages.form.fields.awsSecretKey.name}
              placeholder={Messages.form.fields.awsSecretKey.placeholder}
              label={Messages.form.fields.awsSecretKey.label}
              fieldClassName={styles.credentialsField}
            />
          </div>
        </form>
      )}
    />
  );
};

export default Credentials;
