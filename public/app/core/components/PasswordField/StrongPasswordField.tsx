import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Text, useStyles2 } from '@grafana/ui';
import { Props as InputProps } from '@grafana/ui/src/components/Input/Input';

import { PasswordField } from './PasswordField';

interface Props extends Omit<InputProps, 'type'> {}

export const StrongPasswordField = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const [displayValidationLabels, setDisplayValidationLabels] = useState(false);
  const [pristine, setPristine] = useState(true);
  const [fieldValue, setFieldValue] = useState('');

  const styles = useStyles2((theme: GrafanaTheme2) => {
    return {
      label: css({
        display: displayValidationLabels ? 'flex' : 'none',
        marginTop: theme.spacing(1),
      }),
      hidden: css({
        display: 'none',
      }),
      icon: {
        style: css({
          marginRight: theme.spacing(1),
        }),
        valid: css({
          color: theme.colors.success.text,
        }),
        pending: css({
          color: theme.colors.secondary.text,
        }),
        error: css({
          color: theme.colors.error.text,
        }),
      },
    };
  });

  const validationLabel = (message: string, validation: () => {}) => {
    const result = fieldValue.length > 0 && validation();

    const iconName = result || pristine ? 'check' : 'exclamation-triangle';
    const textColor = result ? 'secondary' : pristine ? 'primary' : 'error';
    let iconClassName = undefined;
    if (result) {
      iconClassName = styles.icon.valid;
    } else if (pristine) {
      iconClassName = styles.icon.pending;
    } else {
      iconClassName = styles.icon.error;
    }

    return (
      <div className={styles.label}>
        <Icon className={styles.icon.style + ' ' + iconClassName} name={iconName} />
        <Text color={textColor}>{message}</Text>
      </div>
    );
  };

  const onFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement, Element>) => {
      setDisplayValidationLabels(true);
      props.onFocus && props.onFocus(event);
    },
    [props.onFocus]
  );

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFieldValue(event.currentTarget.value);
      props.onChange && props.onChange(event);
    },
    [props.onChange]
  );

  const onBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement, Element>) => {
      setPristine(false);
      props.onBlur && props.onBlur(event);
    },
    [props.onBlur]
  );
  console.log(props);
  return (
    <>
      <PasswordField {...props} ref={ref} onFocus={onFocus} onChange={onChange} onBlur={onBlur} />
      {validationLabel('At least 12 characters', () => fieldValue.length >= 12)}
      {validationLabel('One uppercase letter', () => /[A-Z]+/.test(fieldValue))}
      {validationLabel('One lowercase letter', () => /[a-z]+/.test(fieldValue))}
      {validationLabel('One number', () => /[0-9]+/.test(fieldValue))}
      {validationLabel('One symbol', () => /[\W]/.test(fieldValue))}
    </>
  );
});

StrongPasswordField.displayName = 'StrongPasswordField';
