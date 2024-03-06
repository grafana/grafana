import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Text, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';

interface StrongPasswordValidation {
  message: string;
  validation: (value: string) => boolean;
}

export interface Props {
  strongPasswordValidations: StrongPasswordValidation[];
  password: string;
  pristine: boolean;
}

export const strongPasswordValidations: StrongPasswordValidation[] = [
  {
    message: 'At least 12 characters',
    validation: (value: string) => value.length >= 12,
  },
  {
    message: 'One uppercase letter',
    validation: (value: string) => /[A-Z]+/.test(value),
  },
  {
    message: 'One lowercase letter',
    validation: (value: string) => /[a-z]+/.test(value),
  },
  {
    message: 'One number',
    validation: (value: string) => /[0-9]+/.test(value),
  },
  {
    message: 'One symbol',
    validation: (value: string) => /[\W]/.test(value),
  },
];

export const strongPasswordValidationRegister = (value: string) => {
  return (
    !config.auth.basicAuthStrongPasswordPolicy ||
    strongPasswordValidations.every((validation) => validation.validation(value)) ||
    t(
      'profile.change-password.strong-password-validation-register',
      'Password does not comply with the strong password policy'
    )
  );
};

export const ValidationLabels = ({ strongPasswordValidations, password, pristine }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.labelContainer}>
      {strongPasswordValidations.map((validation) => renderValidationLabel(validation, password, pristine, styles))}
    </div>
  );
};

const renderValidationLabel = (
  strongPasswordValidation: StrongPasswordValidation,
  password: string,
  pristine: boolean,
  styles: { [key: string]: string }
) => {
  const { basicAuthStrongPasswordPolicy } = config.auth;
  if (!basicAuthStrongPasswordPolicy) {
    return null;
  }

  const { message, validation } = strongPasswordValidation;
  const result = password.length > 0 && validation(password);

  const iconName = result || pristine ? 'check' : 'exclamation-triangle';
  const textColor = result ? 'secondary' : pristine ? 'primary' : 'error';

  let iconClassName = undefined;
  if (result) {
    iconClassName = styles.iconValid;
  } else if (pristine) {
    iconClassName = styles.iconPending;
  } else {
    iconClassName = styles.iconError;
  }

  return (
    <div key={message} className={styles.label}>
      <Icon className={cx(styles.iconStyle, iconClassName)} name={iconName} />
      <Text color={textColor}>{message}</Text>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    label: css({
      display: 'flex',
      alignItems: 'flex',
      marginTop: theme.spacing(1),
    }),
    labelContainer: css({
      marginBottom: theme.spacing(2),
    }),
    hidden: css({
      display: 'none',
    }),
    iconStyle: css({
      marginRight: theme.spacing(1),
    }),
    iconValid: css({
      color: theme.colors.success.text,
    }),
    iconPending: css({
      color: theme.colors.secondary.text,
    }),
    iconError: css({
      color: theme.colors.error.text,
    }),
  };
};
