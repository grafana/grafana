import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getBackendSrv } from '@grafana/runtime';
import { Field, Input, Button, Legend, Container, LinkButton, Stack } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { t, Trans } from 'app/core/internationalization';
import { w3cStandardEmailValidator } from 'app/features/admin/utils';

interface EmailDTO {
  email: string;
}

export const VerifyEmail = () => {
  const notifyApp = useAppNotification();
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<EmailDTO>();
  const [emailSent, setEmailSent] = useState(false);

  const onSubmit = (formModel: EmailDTO) => {
    getBackendSrv()
      .post('/api/user/signup', formModel)
      .then(() => {
        setEmailSent(true);
      })
      .catch((err) => {
        const msg = err.data?.message || err;
        notifyApp.warning(msg);
      });
  };

  if (emailSent) {
    return (
      <div>
        <p>
          <Trans i18nKey="sign-up.verify.info">
            An email with a verification link has been sent to the email address. You should receive it shortly.
          </Trans>
        </p>
        <Container margin="md" />
        <LinkButton variant="primary" href={getConfig().appSubUrl + '/signup'}>
          <Trans i18nKey="sign-up.verify.complete-button">Complete signup</Trans>
        </LinkButton>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Legend>
        <Trans i18nKey="sign-up.verify.header">Verify email</Trans>
      </Legend>
      <Field
        label={t('sign-up.verify.email-label', 'Email')}
        description={t(
          'sign-up.verify.email-description',
          'Enter your email address to get a verification link sent to you'
        )}
        invalid={!!errors.email}
        error={errors.email?.message}
      >
        <Input
          id="email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: w3cStandardEmailValidator,
              message: 'Email is invalid',
            },
          })}
        />
      </Field>
      <Stack>
        <Button type="submit">
          <Trans i18nKey="sign-up.verify.send-button">Send verification email</Trans>
        </Button>
        <LinkButton fill="text" href={getConfig().appSubUrl + '/login'}>
          <Trans i18nKey="sign-up.verify.back-button">Back to login</Trans>
        </LinkButton>
      </Stack>
    </form>
  );
};
