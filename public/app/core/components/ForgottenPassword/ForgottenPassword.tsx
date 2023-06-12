import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Form, Field, Input, Button, Legend, Container, useStyles2, HorizontalGroup, LinkButton } from '@grafana/ui';
import config from 'app/core/config';

interface EmailDTO {
  userOrEmail: string;
}

const paragraphStyles = (theme: GrafanaTheme2) => css`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.bodySmall.fontSize};
  font-weight: ${theme.typography.fontWeightRegular};
  margin-top: ${theme.spacing(1)};
  display: block;
`;

export const ForgottenPassword = () => {
  const [emailSent, setEmailSent] = useState(false);
  const styles = useStyles2(paragraphStyles);
  const loginHref = `${config.appSubUrl}/login`;

  const sendEmail = async (formModel: EmailDTO) => {
    const res = await getBackendSrv().post('/api/user/password/send-reset-email', formModel);
    if (res) {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <div>
        <p>An email with a reset link has been sent to the email address. You should receive it shortly.</p>
        <Container margin="md" />
        <LinkButton variant="primary" href={loginHref}>
          Back to login
        </LinkButton>
      </div>
    );
  }
  return (
    <Form onSubmit={sendEmail}>
      {({ register, errors }) => (
        <>
          <Legend>Reset password</Legend>
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
          <HorizontalGroup>
            <Button type="submit">Send reset email</Button>
            <LinkButton fill="text" href={loginHref}>
              Back to login
            </LinkButton>
          </HorizontalGroup>

          <p className={styles}>Did you forget your username or email? Contact your Grafana administrator.</p>
        </>
      )}
    </Form>
  );
};
