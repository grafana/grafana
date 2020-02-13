import React, { FC } from 'react';
import { Forms } from '@grafana/ui';
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
    <Forms.Form defaultValues={defaultValues} onSubmit={onSubmit}>
      {({ register, errors }) => {
        return (
          <>
            {verifyEmailEnabled && (
              <Forms.Field label="Email verification code (sent to your email)">
                <Forms.Input name="code" size="md" ref={register} placeholder="Code" />
              </Forms.Field>
            )}
            {!autoAssignOrg && (
              <Forms.Field label="Org. name">
                <Forms.Input size="md" name="orgName" placeholder="Org. name" ref={register} />
              </Forms.Field>
            )}
            <Forms.Field label="Your name">
              <Forms.Input size="md" name="name" placeholder="(optional)" ref={register} />
            </Forms.Field>
            <Forms.Field label="Email" invalid={!!errors.email} error={!!errors.email && errors.email.message}>
              <Forms.Input
                size="md"
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
            </Forms.Field>
            <Forms.Field
              label="Password"
              invalid={!!errors.password}
              error={!!errors.password && errors.password.message}
            >
              <Forms.Input
                size="md"
                name="password"
                type="password"
                placeholder="Password"
                ref={register({ required: 'Password is required' })}
              />
            </Forms.Field>

            <Forms.Button type="submit">Submit</Forms.Button>
            <span className={buttonSpacing}>
              <Forms.LinkButton href={getConfig().appSubUrl + '/login'} variant="secondary">
                Back
              </Forms.LinkButton>
            </span>
          </>
        );
      }}
    </Forms.Form>
  );
};
