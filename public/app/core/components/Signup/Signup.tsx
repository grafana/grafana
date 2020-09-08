import React, { FC } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { Form, Field, Input, Button, HorizontalGroup, LinkButton } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { AppEvents } from '@grafana/data';

interface SignupDTO {
  name: string;
  email: string;
  username: string;
  orgName?: string;
  password: string;
  code: string;
  confirm: string;
}

interface ConnectedProps {
  email?: string;
  code?: string;
}

const SignupUnconnected: FC<ConnectedProps> = props => {
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
      .catch(err => {
        const msg = err.data?.message || err;
        appEvents.emit(AppEvents.alertWarning, [msg]);
      });

    if (response.code === 'redirect-to-select-org') {
      window.location.href = getConfig().appSubUrl + '/profile/select-org?signup=1';
    }
    window.location.href = getConfig().appSubUrl + '/';
  };

  const defaultValues = {
    email: props.email,
    code: props.code,
  };

  return (
    <Form defaultValues={defaultValues} onSubmit={onSubmit}>
      {({ errors, register, getValues }) => (
        <>
          <Field label="Your name">
            <Input name="name" placeholder="(optional)" ref={register} />
          </Field>
          <Field label="Email" invalid={!!errors.email} error={errors.email?.message}>
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
          {!getConfig().autoAssignOrg && (
            <Field label="Org. name">
              <Input name="orgName" placeholder="Org. name" ref={register} />
            </Field>
          )}
          {getConfig().verifyEmailEnabled && (
            <Field label="Email verification code (sent to your email)">
              <Input name="code" ref={register} placeholder="Code" />
            </Field>
          )}
          <Field label="Password" invalid={!!errors.password} error={errors?.password?.message}>
            <Input
              autoFocus
              type="password"
              name="password"
              ref={register({
                required: 'Password is required',
              })}
            />
          </Field>
          <Field label="Confirm password" invalid={!!errors.confirm} error={errors?.confirm?.message}>
            <Input
              type="password"
              name="confirm"
              ref={register({
                required: 'Confirmed password is required',
                validate: v => v === getValues().password || 'Passwords must match!',
              })}
            />
          </Field>

          <HorizontalGroup>
            <Button type="submit">Submit</Button>
            <LinkButton variant="link" href={getConfig().appSubUrl + '/login'}>
              Back to login
            </LinkButton>
          </HorizontalGroup>
        </>
      )}
    </Form>
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, {}, StoreState> = (state: StoreState) => ({
  email: state.location.routeParams.email?.toString(),
  code: state.location.routeParams.code?.toString(),
});

export const Signup = connect(mapStateToProps)(SignupUnconnected);
