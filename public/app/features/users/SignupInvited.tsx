import React, { FC, useEffect } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { updateLocation } from 'app/core/actions';
import { UrlQueryValue, getBackendSrv } from '@grafana/runtime';
import { Forms } from '@grafana/ui';

interface ConnectedProps {
  code?: UrlQueryValue;
}

interface DispatchProps {
  updateLocation: typeof updateLocation;
}

interface FormModel {
  email: string;
  name?: string;
  username: string;
  password?: string;
}

const SingupInvitedPageUnconnected: FC<DispatchProps & ConnectedProps> = ({ code, updateLocation }) => {
  let initFormModel: FormModel;
  let greeting: string;
  let invitedBy: string;
  useEffect(() => {
    const invite = await getBackendSrv().get('/api/user/invite/' + code);
    initFormModel = {
      email: invite.email,
      name: invite.name,
      username: invite.email,
    };
  }, []);

  const onSubmit = async (formData: FormModel) => {
    getBackendSrv()
      .post('/api/user/invite/complete', { ...formData, inviteCode: code })
      .then(() => {
        window.location.href = config.appSubUrl + '/';
      });
  };

  return (
    <>
      <Forms.Form defaultValues={formModel} onSubmit={onSubmit}>
        {({ register, errors }) => (
          <>
            <Forms.Field invalid={!!errors.email} error={!!errors.email && errors.email.message} label="Email">
              <Forms.Input
                placeholder="email@example.com"
                name="email"
                ref={register({
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/,
                    message: 'Email is invalid',
                  },
                })}
              />
            </Forms.Field>
            <Forms.Field invalid={!!errors.name} error={!!errors.name && errors.name.message} label="Name">
              <Forms.Input placeholder="Name (optional)" name="name" ref={register} />
            </Forms.Field>
            <Forms.Field
              invalid={!!errors.username}
              error={!!errors.username && errors.username.message}
              label="Username"
            >
              <Forms.Input
                placeholder="Name (optional)"
                name="name"
                ref={register({ required: 'Username is required' })}
              />
            </Forms.Field>
            <Forms.Field
              invalid={!!errors.password}
              error={!!errors.password && errors.password.message}
              label="Password"
            >
              <Forms.Input
                type="password"
                placeholder="Password"
                name="password"
                ref={register({ required: 'Password is required' })}
              />
            </Forms.Field>
          </>
        )}
      </Forms.Form>
    </>
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, {}, StoreState> = (state: StoreState) => ({
  code: state.location.routeParams.code,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, {}> = {
  updateLocation,
};

export const SignupInvitedPage = hot(module)(
  connect(mapStateToProps, mapDispatchToProps)(SingupInvitedPageUnconnected)
);
