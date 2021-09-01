import { Form as FormFinal } from 'react-final-form';
import React, { FC, useCallback } from 'react';
import { TextInputField, PasswordInputField } from '@percona/platform-core';
import { Button, useTheme } from '@grafana/ui';
import { getStyles } from './Credentials.styles';
import { Messages } from './Credentials.messages';
import { CredentialsForm, CredentialsProps } from './Credentials.types';

const Credentials: FC<CredentialsProps> = ({ discover, selectInstance }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const onSubmit = useCallback((values: CredentialsForm) => {
    discover(values);
  }, []);

  return (
    <FormFinal
      onSubmit={onSubmit}
      render={({ handleSubmit }) => (
        <form onSubmit={handleSubmit} className={styles.instanceForm}>
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
          <div className={styles.buttonsWrapper}>
            <Button variant="secondary" onClick={() => selectInstance({ type: '' })} icon="arrow-left">
              {Messages.form.toMenuButton}
            </Button>
            <Button type="submit" data-qa="credentials-search-button" className={styles.credentialsSubmit}>
              {Messages.form.submitButton}
            </Button>
          </div>
          <div></div>
        </form>
      )}
    />
  );
};

export default Credentials;
