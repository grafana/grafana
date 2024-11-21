import { css } from '@emotion/css';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Field, Input, Button, Legend, Container, useStyles2, LinkButton, Stack } from '@grafana/ui';
import config from 'app/core/config';
import { Trans } from 'app/core/internationalization';

interface EmailDTO {
  userOrEmail: string;
}

const paragraphStyles = (theme: GrafanaTheme2) =>
  css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
    marginTop: theme.spacing(1),
    display: 'block',
  });

export const ForgottenPassword = () => {
  const [emailSent, setEmailSent] = useState(false);
  const styles = useStyles2(paragraphStyles);
  const loginHref = `${config.appSubUrl}/login`;
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<EmailDTO>();

  const sendEmail = async (formModel: EmailDTO) => {
    const res = await getBackendSrv().post('/api/user/password/send-reset-email', formModel);
    if (res) {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <div>
        <p>
          <Trans i18nKey="forgot-password.email-sent">
            An email with a reset link has been sent to the email address. You should receive it shortly.
          </Trans>
        </p>
        <Container margin="md" />
        <LinkButton variant="primary" href={loginHref}>
          <Trans i18nKey="forgot-password.back-button">Back to login</Trans>
        </LinkButton>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit(sendEmail)}>
      <Legend>
        <Trans i18nKey="forgot-password.reset-password-header">Reset password</Trans>
      </Legend>
      <Field
        label="User"
        description="Enter your information to get a reset link sent to you"
        invalid={!!errors.userOrEmail}
        error={errors?.userOrEmail?.message}
      >
        <Input
          id="user-input"
          placeholder="Email or username"
          {...register('userOrEmail', { required: 'Email or username is required' })}
        />
      </Field>
      <Stack>
        <Button type="submit">
          <Trans i18nKey="forgot-password.send-email-button">Send reset email</Trans>
        </Button>
        <LinkButton fill="text" href={loginHref}>
          <Trans i18nKey="forgot-password.back-button">Back to login</Trans>
        </LinkButton>
      </Stack>

      <p className={styles}>
        <Trans i18nKey="forgot-password.contact-admin">
          Did you forget your username or email? Contact your Grafana administrator.
        </Trans>
      </p>
    </form>
  );
};
