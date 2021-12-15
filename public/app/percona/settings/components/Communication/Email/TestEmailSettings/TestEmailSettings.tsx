import React, { FC, useState } from 'react';
import { Button, useStyles } from '@grafana/ui';
import { Form } from 'react-final-form';
import { TextInputField, validators } from '@percona/platform-core';
import { getStyles } from './TestEmailSettings.styles';
import { Messages } from './TestEmailSettings.messages';
import { TestEmailSettingsProps } from './TestEmailSettings.types';

export const TestEmailSettings: FC<TestEmailSettingsProps> = ({ onTest, onInput = () => null, initialValue = '' }) => {
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
