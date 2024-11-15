import { css } from '@emotion/css';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Input, Field, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { PasswordlessFormModel } from './LoginCtrl';

interface Props {
  onSubmit: (data: PasswordlessFormModel) => void;
  isLoggingIn: boolean;
}

export const PasswordlessLoginForm = ({ onSubmit, isLoggingIn }: Props) => {
  const styles = useStyles2(getStyles);
  const emailId = useId();
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<PasswordlessFormModel>({ mode: 'onChange' });

  return (
    <div className={styles.wrapper}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Field label={t('login.form.email-label', 'Email')} invalid={!!errors.email} error={errors.email?.message}>
          <Input
            {...register('email', { required: t('login.form.email-required', 'Email is required') })}
            id={emailId}
            autoFocus
            autoCapitalize="none"
            placeholder={t('login.form.email-placeholder', 'email')}
            data-testid={selectors.pages.PasswordlessLogin.email}
          />
        </Field>
        <Button
          type="submit"
          data-testid={selectors.pages.Login.submit}
          className={styles.submitButton}
          disabled={isLoggingIn}
        >
          {isLoggingIn
            ? t('login.form.verify-email-loading-label', 'Sending email...')
            : t('login.form.verify-email-label', 'Send a verification email')}
        </Button>
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
