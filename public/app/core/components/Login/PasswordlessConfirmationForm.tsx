import { css } from '@emotion/css';
import { useId, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Input, Field, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { PasswordlessConfirmationFormModel } from './LoginCtrl';

interface Props {
  onSubmit: (data: PasswordlessConfirmationFormModel) => void;
  isLoggingIn: boolean;
}

export const PasswordlessConfirmation = ({ onSubmit, isLoggingIn }: Props) => {
  const styles = useStyles2(getStyles);
  const confirmationCodeId = useId();
  const codeId = useId();

  const {
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useForm<PasswordlessConfirmationFormModel>({ mode: 'onChange' });

  useEffect(() => {
    const queryValues = Object.fromEntries(
      new URLSearchParams(window.location.search.split(/\?/)[1])
    );
    const code = queryValues.code;

    setValue('code', code);
  }, [setValue]);

  return (
    <div className={styles.wrapper}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Field hidden={true}>
          <Input
            {...register('code')}
            id={codeId}
            hidden={true}
          />
        </Field>
        <Field label={t('login.form.confirmation-code-label', 'Confirmation code')} invalid={!!errors.code} error={errors.code?.message}>
          <Input
            {...register('confirmationCode', { required: t('login.form.confirmation-code', 'Confirmation code is required') })}
            id={confirmationCodeId}
            autoFocus
            autoCapitalize="none"
            placeholder={t('login.form.confirmation-code-placeholder', 'Confirmation code')}
            data-testid={selectors.pages.PasswordlessLogin.email}
          />
        </Field>
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
