import React, { FC, useCallback } from 'react';
import { Form as FormFinal } from 'react-final-form';

import { Button, useStyles } from '@grafana/ui';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { SECURITY_CREDENTIALS_DOC_LINK } from './Credentials.constants';
import { Messages } from './Credentials.messages';
import { getStyles } from './Credentials.styles';
import { AzureCredentialsForm, CredentialsProps } from './Credentials.types';

const Credentials: FC<CredentialsProps> = ({ onSetCredentials, selectInstance }) => {
  const styles = useStyles(getStyles);

  const onSubmit = useCallback((values: AzureCredentialsForm) => {
    onSetCredentials({ ...values });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FormFinal
      onSubmit={onSubmit}
      render={({ handleSubmit }) => (
        <form id="add-instance-form" onSubmit={handleSubmit} className={styles.instanceForm}>
          <div className={styles.searchPanel}>
            <TextInputField
              name={Messages.form.fields.clientId.name}
              placeholder={Messages.form.fields.clientId.placeholder}
              label={Messages.form.fields.clientId.label}
              validators={[validators.required]}
              fieldClassName={styles.credentialsField}
            />
            <PasswordInputField
              name={Messages.form.fields.clientSecret.name}
              placeholder={Messages.form.fields.clientSecret.placeholder}
              label={Messages.form.fields.clientSecret.label}
              validators={[validators.required]}
              fieldClassName={styles.credentialsField}
            />
          </div>
          <div className={styles.searchPanel}>
            <TextInputField
              name={Messages.form.fields.tenantId.name}
              placeholder={Messages.form.fields.tenantId.placeholder}
              label={Messages.form.fields.tenantId.label}
              validators={[validators.required]}
              fieldClassName={styles.credentialsField}
            />
            <TextInputField
              name={Messages.form.fields.subscriptionId.name}
              placeholder={Messages.form.fields.subscriptionId.placeholder}
              label={Messages.form.fields.subscriptionId.label}
              validators={[validators.required]}
              fieldClassName={styles.credentialsField}
            />
          </div>
          <div className={styles.searchPanel}>
            <Button type="button" fill="text" onClick={() => window.open(SECURITY_CREDENTIALS_DOC_LINK, '_blank')}>
              {Messages.form.credentialsDocLink}
            </Button>
          </div>
          <div></div>
        </form>
      )}
    />
  );
};

export default Credentials;
