import React, { FC, useState } from 'react';
import { Form, Field, Input, Button, Legend, Container, HorizontalGroup, LinkButton } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { AppEvents } from '@grafana/data';

interface EmailDTO {
  email: string;
}

export const VerifyEmail: FC = () => {
  const [emailSent, setEmailSent] = useState(false);

  const onSubmit = (formModel: EmailDTO) => {
    getBackendSrv()
      .post('/api/user/signup', formModel)
      .then(() => {
        setEmailSent(true);
      })
      .catch(err => {
        const msg = err.data?.message || err;
        appEvents.emit(AppEvents.alertWarning, [msg]);
      });
  };

  if (emailSent) {
    return (
      <div>
        <p>An email with a verification link has been sent to the email address. You should receive it shortly.</p>
        <Container margin="md" />
        <LinkButton variant="primary" href={getConfig().appSubUrl + '/signup'}>
          Complete Signup
        </LinkButton>
      </div>
    );
  }

  return (
    <Form onSubmit={onSubmit}>
      {({ register, errors }) => (
        <>
          <Legend>Verify Email</Legend>
          <Field
            label="Email"
            description="Enter your email address to get a verification link sent to you"
            invalid={!!(errors as any).email}
            error={(errors as any).email?.message}
          >
            <Input placeholder="Email" name="email" ref={register({ required: true })} />
          </Field>
          <HorizontalGroup>
            <Button>Send verification email</Button>
            <LinkButton variant="link" href={getConfig().appSubUrl + '/login'}>
              Back to login
            </LinkButton>
          </HorizontalGroup>
        </>
      )}
    </Form>
  );
};
