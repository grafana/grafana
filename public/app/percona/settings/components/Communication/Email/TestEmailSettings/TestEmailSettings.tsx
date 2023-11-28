import React, { FC, useState } from 'react';
import { Form } from 'react-final-form';

import { Button, useStyles } from '@grafana/ui';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { Messages } from './TestEmailSettings.messages';
import { getStyles } from './TestEmailSettings.styles';
import { TestEmailSettingsProps } from './TestEmailSettings.types';

export const TestEmailSettings: FC<React.PropsWithChildren<TestEmailSettingsProps>> = ({ onTest, onInput = () => null, initialValue = '' }) => {
  const [testingSettings, setTestingSettings] = useState(false);
  const styles = useStyles(getStyles);

  const handleClick = async (email: string) => {
    setTestingSettings(true);
    await onTest(email);
    setTestingSettings(false);
  };

  return (
    <Form
      onSubmit={() => {}}
      initialValues={{ testEmail: initialValue }}
      render={({ values, valid }) => (
        <form className={styles.form}>
          <TextInputField
            name="testEmail"
            fieldClassName={styles.input}
            label={Messages.testEmail}
            tooltipText={Messages.tooltip}
            validators={[validators.email]}
            inputProps={{
              onInput: (e) => onInput(e.currentTarget.value),
            }}
          />
          <Button
            type="button"
            className={styles.button}
            disabled={testingSettings || !values.testEmail || !valid}
            onClick={() => handleClick(values.testEmail)}
          >
            {Messages.test}
          </Button>
        </form>
      )}
    ></Form>
  );
};
