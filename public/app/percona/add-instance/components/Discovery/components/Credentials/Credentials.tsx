import { Form as FormFinal } from 'react-final-form';
import React, { FC, useCallback } from 'react';
import { PasswordInputField, TextInputField } from '@percona/platform-core';
import { Button, useTheme } from '@grafana/ui';
import { getStyles } from './Credentials.styles';
import { SECURITY_CREDENTIALS_DOC_LINK } from './Credentials.constants';
import { Messages } from './Credentials.messages';
import { CredentialsForm, CredentialsProps } from './Credentials.types';

const Credentials: FC<CredentialsProps> = ({ onSetCredentials, selectInstance }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const onSubmit = useCallback((values: CredentialsForm) => {
    onSetCredentials({ ...values });
  }, []);

  return (
    <FormFinal
      onSubmit={onSubmit}
      render={({ handleSubmit }) => (
        <form onSubmit={handleSubmit} className={styles.instanceForm}>
          <div className={styles.searchPanel}>
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
          <div className={styles.searchPanel}>
            <Button variant="secondary" onClick={() => selectInstance({ type: '' })} icon="arrow-left">
              {Messages.form.toMenuButton}
            </Button>
            <Button type="submit" data-qa="credentials-search-button" className={styles.credentialsSubmit}>
              {Messages.form.submitButton}
            </Button>
            <Button type="button" variant="link" onClick={() => window.open(SECURITY_CREDENTIALS_DOC_LINK, '_blank')}>
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
