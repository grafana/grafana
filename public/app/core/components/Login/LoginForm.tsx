import { css, cx } from '@emotion/css';
import { pickBy } from 'lodash';
import { type ReactElement, useId } from 'react';
import { useForm } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, Input, Field, Stack, Text, useStyles2 } from '@grafana/ui';

import { PasswordField } from '../PasswordField/PasswordField';

import { type FormModel } from './LoginCtrl';
import { loginServices } from './LoginServiceButtons';
import { PASSWORD_LOGIN_METHOD, recordLastUsedLoginMethod, useLastUsedLoginMethod } from './useLastUsedLoginMethod';

interface Props {
  children: ReactElement;
  onSubmit: (data: FormModel) => void;
  isLoggingIn: boolean;
  passwordHint: string;
  loginHint: string;
}

export const LoginForm = ({ children, onSubmit, isLoggingIn, passwordHint, loginHint }: Props) => {
  const styles = useStyles2(getStyles);
  const usernameId = useId();
  const passwordId = useId();
  const lastUsedCaptionId = useId();
  const lastUsed = useLastUsedLoginMethod();
  // LoginForm only renders when the password form is enabled, so any enabled SSO service means multiple methods exist.
  const multipleMethodsEnabled = Object.keys(pickBy(loginServices(), (service) => service.enabled)).length > 0;
  const isLastUsed = multipleMethodsEnabled && lastUsed === PASSWORD_LOGIN_METHOD;
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormModel>({ mode: 'onChange' });

  const handleSubmitInternal = (data: FormModel) => {
    recordLastUsedLoginMethod(PASSWORD_LOGIN_METHOD);
    onSubmit(data);
  };

  return (
    <div className={styles.wrapper}>
      <form onSubmit={handleSubmit(handleSubmitInternal)}>
        <Stack direction="column" gap={3}>
          <Field
            label={t('login.form.username-label', 'Email or username')}
            invalid={!!errors.user}
            error={errors.user?.message}
            noMargin
          >
            <Input
              {...register('user', { required: t('login.form.username-required', 'Email or username is required') })}
              id={usernameId}
              autoFocus
              autoCapitalize="none"
              placeholder={loginHint || t('login.form.username-placeholder', 'email or username')}
              data-testid={selectors.pages.Login.username}
            />
          </Field>
          <Field
            label={t('login.form.password-label', 'Password')}
            invalid={!!errors.password}
            error={errors.password?.message}
            noMargin
          >
            <PasswordField
              {...register('password', { required: t('login.form.password-required', 'Password is required') })}
              id={passwordId}
              autoComplete="current-password"
              placeholder={passwordHint || t('login.form.password-placeholder', 'password')}
            />
          </Field>
          <Stack direction="column" gap={0.5} width="100%">
            <Button
              type="submit"
              data-testid={selectors.pages.Login.submit}
              className={cx(styles.submitButton, isLastUsed && styles.lastUsedHighlight)}
              disabled={isLoggingIn}
              aria-describedby={isLastUsed ? lastUsedCaptionId : undefined}
            >
              {isLoggingIn
                ? t('login.form.submit-loading-label', 'Logging in...')
                : t('login.form.submit-label', 'Log in')}
            </Button>
            {isLastUsed && (
              <Text id={lastUsedCaptionId} variant="bodySmall" element="span" weight="medium">
                <span className={styles.lastUsedLabel}>
                  <Trans i18nKey="login.last-used-method">Last used</Trans>
                </span>
              </Text>
            )}
          </Stack>
        </Stack>
        {children}
      </form>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      width: '100%',
      paddingBottom: theme.spacing(2),
    }),

    submitButton: css({
      justifyContent: 'center',
      width: '100%',
    }),

    lastUsedHighlight: css({
      position: 'relative',
      '&::after': {
        content: '""',
        position: 'absolute',
        inset: '-4px',
        border: `1px solid ${theme.colors.success.border}`,
        borderTopLeftRadius: `calc(${theme.shape.radius.default} + 3px)`,
        borderTopRightRadius: `calc(${theme.shape.radius.default} + 3px)`,
        borderBottomRightRadius: `calc(${theme.shape.radius.default} + 3px)`,
        pointerEvents: 'none',
      },
    }),

    lastUsedLabel: css({
      backgroundColor: theme.colors.success.border,
      color: theme.colors.success.contrastText,
      padding: theme.spacing(0.25, 1),
      marginLeft: '-3px',
      borderBottomLeftRadius: theme.shape.radius.sm,
      borderBottomRightRadius: theme.shape.radius.sm,
      lineHeight: 1.2,
    }),

    skipButton: css({
      alignSelf: 'flex-start',
    }),
  };
};
