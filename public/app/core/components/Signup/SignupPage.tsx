import React, { FC } from 'react';
import { Form, Field, Input, Button, HorizontalGroup, LinkButton, FormAPI } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { AppEvents } from '@grafana/data';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { InnerBox, LoginLayout } from '../Login/LoginLayout';

interface SignupDTO {
  name?: string;
  email: string;
  username: string;
  orgName?: string;
  password: string;
  code: string;
  confirm?: string;
}

interface QueryParams {
  email?: string;
  code?: string;
}

interface Props extends GrafanaRouteComponentProps<{}, QueryParams> {}

export const SignupPage: FC<Props> = (props) => {
  const onSubmit = async (formData: SignupDTO) => {
    if (formData.name === '') {
      delete formData.name;
    }
    delete formData.confirm;

    const response = await getBackendSrv()
      .post('/api/user/signup/step2', {
        email: formData.email,
        code: formData.code,
        username: formData.email,
        orgName: formData.orgName,
        password: formData.password,
        name: formData.name,
      })
      .catch((err) => {
        const msg = err.data?.message || err;
        appEvents.emit(AppEvents.alertWarning, [msg]);
      });

    if (response.code === 'redirect-to-select-org') {
      window.location.href = getConfig().appSubUrl + '/profile/select-org?signup=1';
    }
    window.location.href = getConfig().appSubUrl + '/';
  };

  const defaultValues = {
    email: props.queryParams.email,
    code: props.queryParams.code,
  };

  return (
    <LoginLayout>
      <InnerBox>
        <Form defaultValues={defaultValues} onSubmit={onSubmit}>
          {({ errors, register, getValues }: FormAPI<SignupDTO>) => (
            <>
              <Field label="Your name">
                <Input {...register('name')} placeholder="(optional)" />
              </Field>
              <Field label="Email" invalid={!!errors.email} error={errors.email?.message}>
                <Input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^\S+@\S+$/,
                      message: 'Email is invalid',
                    },
                  })}
                  type="email"
                  placeholder="Email"
                />
              </Field>
              {!getConfig().autoAssignOrg && (
                <Field label="Org. name">
                  <Input {...register('orgName')} placeholder="Org. name" />
                </Field>
              )}
              {getConfig().verifyEmailEnabled && (
                <Field label="Email verification code (sent to your email)">
                  <Input {...register('code')} placeholder="Code" />
                </Field>
              )}
              <Field label="Password" invalid={!!errors.password} error={errors?.password?.message}>
                <Input
                  {...register('password', {
                    required: 'Password is required',
                  })}
                  autoFocus
                  type="password"
                />
              </Field>
              <Field label="Confirm password" invalid={!!errors.confirm} error={errors?.confirm?.message}>
                <Input
                  {...register('confirm', {
                    required: 'Confirmed password is required',
                    validate: (v) => v === getValues().password || 'Passwords must match!',
                  })}
                  type="password"
                />
              </Field>

              <HorizontalGroup>
                <Button type="submit">Submit</Button>
                <LinkButton fill="text" href={getConfig().appSubUrl + '/login'}>
                  Back to login
                </LinkButton>
              </HorizontalGroup>
            </>
          )}
        </Form>
      </InnerBox>
    </LoginLayout>
  );
};

export default SignupPage;
