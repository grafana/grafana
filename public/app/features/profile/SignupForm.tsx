import React, { FC } from 'react';
import { Button, LinkButton, Input, Form, Field } from '@grafana/ui';
import { css } from 'emotion';

import { getConfig } from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';

interface SignupFormModel {
  email: string;
  username?: string;
  password: string;
  orgName: string;
  code?: string;
  name?: string;
}
interface Props {
  email?: string;
  orgName?: string;
  username?: string;
  code?: string;
  name?: string;
  verifyEmailEnabled?: boolean;
  autoAssignOrg?: boolean;
}

const buttonSpacing = css`
  margin-left: 15px;
`;

export const SignupForm: FC<Props> = props => {
  const verifyEmailEnabled = props.verifyEmailEnabled;
  const autoAssignOrg = props.autoAssignOrg;

  const onSubmit = async (formData: SignupFormModel) => {
    if (formData.name === '') {
      delete formData.name;
    }

    const response = await getBackendSrv().post('/api/user/signup/step2', {
      email: formData.email,
      code: formData.code,
      username: formData.email,
      orgName: formData.orgName,
      password: formData.password,
      name: formData.name,
    });

    if (response.code === 'redirect-to-select-org') {
      window.location.href = getConfig().appSubUrl + '/profile/select-org?signup=1';
    }
    window.location.href = getConfig().appSubUrl + '/';
  };

  const defaultValues = {
    orgName: props.orgName,
    email: props.email,
    username: props.email,
    code: props.code,
    name: props.name,
  };

  return (
    <Form defaultValues={defaultValues} onSubmit={onSubmit}>
      {({ register, errors }) => {
        return (
          <>
            {verifyEmailEnabled && (
              <Field label="Email verification code (sent to your email)">
                <Input name="code" ref={register} placeholder="Code" />
              </Field>
            )}
            {!autoAssignOrg && (
              <Field label="Org. name">
                <Input name="orgName" placeholder="Org. name" ref={register} />
              </Field>
            )}
            <Field label="Your name">
              <Input name="name" placeholder="(optional)" ref={register} />
            </Field>
            <Field label="Email" invalid={!!errors.email} error={!!errors.email && errors.email.message}>
              <Input
                name="email"
                type="email"
                placeholder="Email"
                ref={register({
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/,
                    message: 'Email is invalid',
                  },
                })}
              />
            </Field>
            <Field label="Password" invalid={!!errors.password} error={!!errors.password && errors.password.message}>
              <Input
                name="password"
                type="password"
                placeholder="Password"
                ref={register({ required: 'Password is required' })}
              />
            </Field>

            <Button type="submit">Submit</Button>
            <span className={buttonSpacing}>
              <LinkButton href={getConfig().appSubUrl + '/login'} variant="secondary">
                Back
              </LinkButton>
            </span>
          </>
        );
      }}
    </Form>
  );
};
