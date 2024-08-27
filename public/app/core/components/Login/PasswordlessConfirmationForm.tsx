import { css } from '@emotion/css';
import { useId, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Input, Field, useStyles2 } from '@grafana/ui';
import { Branding } from 'app/core/components/Branding/Branding';
import { t } from 'app/core/internationalization';

import { PasswordlessConfirmationFormModel } from './LoginCtrl';

interface Props {
  onSubmit: (data: PasswordlessConfirmationFormModel) => void;
  isLoggingIn: boolean;
}

export const PasswordlessConfirmation = ({ onSubmit, isLoggingIn }: Props) => {
  const styles = useStyles2(getStyles);
  const confirmationCodeId = useId();
  const codeId = useId();
  const usernameId = useId();
  const nameId = useId();
  const [signup, setSignup] = useState(false);

  const {
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useForm<PasswordlessConfirmationFormModel>({ mode: 'onChange' });

  useEffect(() => {
    Branding.LoginTitle = "We've sent you an email!";
    Branding.GetLoginSubTitle = () =>
      "Check your inbox and click the confirmation link or use the confirmation code we've sent.";

    const queryValues = Object.fromEntries(new URLSearchParams(window.location.search.split(/\?/)[1]));
    console.log('queryValues', queryValues);
    console.log('signup', queryValues.signup);
    setValue('code', queryValues.code);
    if (queryValues.confirmationCode) {
      setValue('confirmationCode', queryValues.confirmationCode);
      if (!queryValues.signup) {
        handleSubmit(onSubmit)();
      }
    }
    if (queryValues.signup) {
      setSignup(true);
    }
    if (queryValues.username) {
      setValue('username', queryValues.username);
    }
    if (queryValues.name) {
      setValue('name', queryValues.name);
    }
  }, [setValue, handleSubmit, onSubmit, setSignup]);

  return (
    <div className={styles.wrapper}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Field hidden={true}>
          <Input {...register('code')} id={codeId} hidden={true} />
        </Field>
        <Field
          label={t('login.form.confirmation-code-label', 'Confirmation code')}
          invalid={!!errors.code}
          error={errors.code?.message}
        >
          <Input
            {...register('confirmationCode', {
              required: t('login.form.confirmation-code', 'Confirmation code is required'),
            })}
            id={confirmationCodeId}
            autoFocus
            autoCapitalize="none"
            placeholder={t('login.form.confirmation-code-placeholder', 'confirmation code')}
            data-testid={selectors.pages.PasswordlessLogin.email}
          />
        </Field>
        {signup && (
          <>
            <Field label={'Username'} invalid={!!errors.code} error={errors.code?.message} hidden={true}>
              <Input
                {...register('username')}
                id={usernameId}
                autoFocus
                autoCapitalize="none"
                placeholder={'username'}
                data-testid={selectors.pages.PasswordlessLogin.email}
                hidden={true}
              />
            </Field>
            <Field label={t('login.form.name-label', 'Name')} invalid={!!errors.code} error={errors.code?.message}>
              <Input
                {...register('name')}
                id={nameId}
                autoFocus
                autoCapitalize="none"
                placeholder={t('login.form.confirmation-code-placeholder', 'name')}
                data-testid={selectors.pages.PasswordlessLogin.email}
              />
            </Field>
          </>
        )}
        <Button
          type="submit"
          data-testid={selectors.pages.Login.submit}
          className={styles.submitButton}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? t('login.form.submit-loading-label', 'Logging in...') : t('login.form.submit-label', 'Log in')}
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
