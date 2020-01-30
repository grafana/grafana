import React, { FC } from 'react';
import { Forms } from '@grafana/ui';
import { SignupFormModel, SignupCtrlState } from './SignupCtrl';
import { css } from 'emotion';

interface Props {
  verifyEmailEnabled: boolean;
  autoAssignOrg: boolean;
  onSubmit(obj: SignupFormModel): void;
  defaultValues: SignupCtrlState;
}

const buttonSpacing = css`
  margin-left: 15px;
`;

export const SignupForm: FC<Props> = props => {
  return (
    <Forms.Form defaultValues={props.defaultValues} onSubmit={props.onSubmit}>
      {({ register, errors }) => {
        return (
          <>
            {props.verifyEmailEnabled && (
              <Forms.Field label="Email verification code (sent to your email)">
                <Forms.Input name="code" size="md" ref={register} placeholder="Code" />
              </Forms.Field>
            )}
            {!props.autoAssignOrg && (
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
              <Forms.Button variant="secondary">Back</Forms.Button>
            </span>
          </>
        );
      }}
    </Forms.Form>
  );
};
