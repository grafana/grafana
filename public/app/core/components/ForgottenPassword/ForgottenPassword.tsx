import React, { FC, useState } from 'react';
import { Form, Field, Input, Button, Legend, Container, useStyles, HorizontalGroup, LinkButton } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import config from 'app/core/config';

interface EmailDTO {
  userOrEmail: string;
}

const paragraphStyles = (theme: GrafanaTheme) => css`
  color: ${theme.colors.formDescription};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.weight.regular};
  margin-top: ${theme.spacing.sm};
  display: block;
`;

export const ForgottenPassword: FC = () => {
  const [emailSent, setEmailSent] = useState(false);
  const styles = useStyles(paragraphStyles);
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
            <Input placeholder="Email or username" name="userOrEmail" ref={register({ required: true })} />
          </Field>
          <HorizontalGroup>
            <Button>Send reset email</Button>
            <LinkButton buttonStyle="text" href={loginHref}>
              Back to login
            </LinkButton>
          </HorizontalGroup>

          <p className={styles}>Did you forget your username or email? Contact your Grafana administrator.</p>
        </>
      )}
    </Form>
  );
};
