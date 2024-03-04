import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Text, useStyles2 } from '@grafana/ui';
import { Props as InputProps } from '@grafana/ui/src/components/Input/Input';

import { PasswordField } from './PasswordField';

interface Props extends Omit<InputProps, 'type'> {}

export const StrongPasswordField = React.forwardRef<HTMLInputElement, Props>((_props, _ref) => {
  const [displayValidationLabels, setDisplayValidationLabels] = useState(false);
  const [fieldValue, setFieldValue] = useState('');

  const styles = useStyles2((theme: GrafanaTheme2) => {
    return {
      validation: {
        label: css({
          display: displayValidationLabels ? 'flex' : 'none',
          maginBottom: theme.spacing(2),
        }),
        hidden: css({
          display: 'none',
        }),
        area: css({
          marginBottom: theme.spacing(4),
        }),
        field: css({
          marginBottom: theme.spacing(2),
        }),
      },
    };
  });

  // const errorColor = '#FF5286';
  const successColor = '#6CCF8E';

  const check = 'check';

  const validationLabel = (message: string, validation: () => {}) => {
    const result = fieldValue.length > 0 && validation();
    return (
      <div className={styles.validation.label}>
        <Icon name={check} color={result ? successColor : 'primary'} />
        <Text color={result ? 'secondary' : 'primary'}>{message}</Text>
      </div>
    );
  };

  const onFocus = () => {
    setDisplayValidationLabels(true);
  };

  return (
    <>
      <PasswordField
        className={styles.validation.field}
        onFocus={onFocus}
        onChange={(e) => setFieldValue(e.currentTarget.value)}
      ></PasswordField>
      {validationLabel('At least 12 characters', () => fieldValue.length >= 12)}
      {validationLabel('One uppercase letter', () => /[A-Z]+/.test(fieldValue))}
      {validationLabel('One lowercase letter', () => /[a-z]+/.test(fieldValue))}
      {validationLabel('One number', () => /[0-9]+/.test(fieldValue))}
      {validationLabel('One symbol', () => /[\W]/.test(fieldValue))}
      <div className={styles.validation.area} />
    </>
  );
});

StrongPasswordField.displayName = 'StrongPasswordField';
