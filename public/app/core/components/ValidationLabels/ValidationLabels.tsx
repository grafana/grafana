import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Icon, Text, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';

interface StrongPasswordValidation {
  message: string;
  validation: (value: string) => boolean;
}

export interface ValidationLabelsProps {
  strongPasswordValidations: StrongPasswordValidation[];
  password: string;
  pristine: boolean;
}

export interface ValidationLabelProps {
  strongPasswordValidation: StrongPasswordValidation;
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

export const ValidationLabels = ({ strongPasswordValidations, password, pristine }: ValidationLabelsProps) => {
  return (
    <Box marginBottom={2}>
      {strongPasswordValidations.map((validation) => (
        <ValidationLabel
          key={validation.message}
          strongPasswordValidation={validation}
          password={password}
          pristine={pristine}
        />
      ))}
    </Box>
  );
};

export const ValidationLabel = ({ strongPasswordValidation, password, pristine }: ValidationLabelProps) => {
  const styles = useStyles2(getStyles);

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
    iconClassName = styles.icon.valid;
  } else if (pristine) {
    iconClassName = styles.icon.pending;
  } else {
    iconClassName = styles.icon.error;
  }

  return (
    <Box key={message} display={'flex'} alignItems={'center'} marginTop={1}>
      <Icon className={cx(styles.icon.style, iconClassName)} name={iconName} />
      <Text color={textColor}>{message}</Text>
    </Box>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
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
};
