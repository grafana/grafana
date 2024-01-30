import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getBackendSrv } from '@grafana/runtime';
import { Field, Input, Button, Legend, Container, LinkButton, Stack } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
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
        <p>An email with a verification link has been sent to the email address. You should receive it shortly.</p>
        <Container margin="md" />
        <LinkButton variant="primary" href={getConfig().appSubUrl + '/signup'}>
          Complete Signup
        </LinkButton>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Legend>Verify Email</Legend>
      <Field
        label="Email"
        description="Enter your email address to get a verification link sent to you"
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
          placeholder="Email"
        />
      </Field>
      <Stack>
        <Button type="submit">Send verification email</Button>
        <LinkButton fill="text" href={getConfig().appSubUrl + '/login'}>
          Back to login
        </LinkButton>
      </Stack>
    </form>
  );
};
