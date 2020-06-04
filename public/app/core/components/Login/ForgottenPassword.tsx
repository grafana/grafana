import React, { FC, useState } from 'react';
import { LinkButton, Form, Field, Input, Button, Legend, Container } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';

interface EmailDTO {
  userOrEmail: string;
}

export const ForgottenPassword: FC = () => {
  const [emailSent, setEmailSent] = useState(false);

  const sendEmail = async (formModel: EmailDTO) => {
    const res = await getBackendSrv().post('/api/user/password/send-reset-email', formModel);
    console.log(res);
    if (!res.error) {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <div>
        An email with a reset link has been sent to the email address. <br />
        You should receive it shortly.
        <Container margin="md" />
        <LinkButton variant="primary" href="/">
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
