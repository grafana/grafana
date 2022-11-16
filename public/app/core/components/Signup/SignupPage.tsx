import React, { FC } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { Form, Field, Input, Button, HorizontalGroup, LinkButton, FormAPI } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { w3cStandardEmailValidator } from 'app/features/admin/utils';

import { InnerBox, LoginLayout } from '../Login/LoginLayout';
import { PasswordField } from '../PasswordField/PasswordField';

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
  const notifyApp = useAppNotification();
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
        notifyApp.warning(msg);
      });

    if (response.code === 'redirect-to-select-org') {
      window.location.assign(getConfig().appSubUrl + '/profile/select-org?signup=1');
    }
    window.location.assign(getConfig().appSubUrl + '/');
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
                <Input id="user-name" {...register('name')} placeholder="(optional)" />
              </Field>
              <Field label="Email" invalid={!!errors.email} error={errors.email?.message}>
                <Input
                  id="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: w3cStandardEmailValidator,
                      message: 'Email is invalid',
                    },
                  })}
                  type="email"
                  placeholder="Email"
                />
              </Field>
              {!getConfig().autoAssignOrg && (
                <Field label="Org. name">
                  <Input id="org-name" {...register('orgName')} placeholder="Org. name" />
                </Field>
              )}
              {getConfig().verifyEmailEnabled && (
                <Field label="Email verification code (sent to your email)">
                  <Input id="verification-code" {...register('code')} placeholder="Code" />
                </Field>
              )}
              <Field label="Password" invalid={!!errors.password} error={errors?.password?.message}>
                <PasswordField
                  id="new-password"
                  autoFocus
                  autoComplete="new-password"
                  {...register('password', { required: 'Password is required' })}
                />
              </Field>
              <Field label="Confirm password" invalid={!!errors.confirm} error={errors?.confirm?.message}>
                <PasswordField
                  id="confirm-new-password"
                  autoComplete="new-password"
                  {...register('confirm', {
                    required: 'Confirmed password is required',
                    validate: (v) => v === getValues().password || 'Passwords must match!',
                  })}
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
