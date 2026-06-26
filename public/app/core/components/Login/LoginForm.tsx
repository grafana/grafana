import { css } from '@emotion/css';
import { ReactElement, useId } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Input, Field, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { PasswordField } from '../PasswordField/PasswordField';

import { FormModel } from './LoginCtrl';

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
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormModel>({ mode: 'onChange' });

  return (
    <div className={styles.wrapper}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Field
          label="Адрес электронной почты или имя пользователя"
          invalid={!!errors.user}
          error={errors.user?.message}
        >
          <Input
            {...register('user', {
              required: t(
                'Требуется указать адрес электронной почты или имя пользователя',
                'Email or username is required'
              ),
            })}
            id={usernameId}
            autoFocus
            autoCapitalize="none"
            placeholder="Логин или пароль"
            data-testid={selectors.pages.Login.username}
          />
        </Field>
        <Field label="Пароль" invalid={!!errors.password} error={errors.password?.message}>
          <PasswordField
            {...register('password', { required: t('login.form.password-required', 'Password is required') })}
            id={passwordId}
            autoComplete="current-password"
            placeholder="пароль"
          />
        </Field>
        <Button
          type="submit"
          data-testid={selectors.pages.Login.submit}
          className={styles.submitButton}
          disabled={isLoggingIn}
        >
          Войти
        </Button>
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

    skipButton: css({
      alignSelf: 'flex-start',
    }),
  };
};
