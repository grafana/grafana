import React, { FC, useState } from 'react';
import { LinkButton, Form, Field, Input, Button, Legend } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';

interface EmailDTO {
  userOrEmail: string;
}

export const ForgottenPassword: FC = () => {
  const [emailSent, setEmailSent] = useState(false);

  const sendEmail = async (formModel: EmailDTO) => {
    await getBackendSrv().post('/api/user/password/send-reset-email', formModel.userOrEmail);
    setEmailSent(true);
  };

  if (emailSent) {
    return (
      <div>
        An email with a reset link has been sent to the email address. <br />
        You should receive it shortly.
        <LinkButton variant="primary" href="login">
          Login
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
            description="Enter your informaton to get a reset link sent to you"
            invalid={!!errors.userOrEmail}
            error={errors?.userOrEmail?.message}
          >
            <Input placeholder="Email or username" name="userOrEmail" ref={register({ required: true })} />
          </Field>
          <Button>Send reset email</Button>
        </>
      )}
    </Form>
  );
};
