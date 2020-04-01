import React, { FC, useState } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { updateLocation } from 'app/core/actions';
import { UrlQueryValue, getBackendSrv } from '@grafana/runtime';
import { Forms, Button } from '@grafana/ui';
import { useAsync } from 'react-use';
import Page from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { getConfig } from 'app/core/config';

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

const navModel = {
  main: {
    icon: 'gicon gicon-branding',
    text: 'Invite',
    subTitle: 'Register your Grafana account',
    breadcrumbs: [{ title: 'Login', url: 'login' }],
  },
  node: {
    text: '',
  },
};

const SingupInvitedPageUnconnected: FC<DispatchProps & ConnectedProps> = ({ code }) => {
  const [initFormModel, setInitFormModel] = useState<FormModel>();
  const [greeting, setGreeting] = useState<string>();
  const [invitedBy, setInvitedBy] = useState<string>();
  useAsync(async () => {
    const invite = await getBackendSrv().get('/api/user/invite/' + code);
    setInitFormModel({
      email: invite.email,
      name: invite.name,
      username: invite.email,
    });

    setGreeting(invite.name || invite.email || invite.username);
    setInvitedBy(invite.invitedBy);
  }, []);

  const onSubmit = async (formData: FormModel) => {
    await getBackendSrv().post('/api/user/invite/complete', { ...formData, inviteCode: code });
    window.location.href = getConfig().appSubUrl + '/';
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h3 className="page-sub-heading">Hello {greeting || 'there'}.</h3>

        <div className="modal-tagline p-b-2">
          <em>{invitedBy || 'Someone'}</em> has invited you to join Grafana and the organization{' '}
          <span className="highlight-word">{contextSrv.user.orgName}</span>
          <br />
          Please complete the following and choose a password to accept your invitation and continue:
        </div>
        <Forms.Form defaultValues={initFormModel} onSubmit={onSubmit}>
          {({ register, errors }) => (
            <>
              <Forms.Field invalid={!!errors.email} error={!!errors.email && errors.email.message} label="Email">
                <Forms.Input
                  size="md"
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
                <Forms.Input size="md" placeholder="Name (optional)" name="name" ref={register} />
              </Forms.Field>
              <Forms.Field
                invalid={!!errors.username}
                error={!!errors.username && errors.username.message}
                label="Username"
              >
                <Forms.Input
                  size="md"
                  placeholder="Username"
                  name="username"
                  ref={register({ required: 'Username is required' })}
                />
              </Forms.Field>
              <Forms.Field
                invalid={!!errors.password}
                error={!!errors.password && errors.password.message}
                label="Password"
              >
                <Forms.Input
                  size="md"
                  type="password"
                  placeholder="Password"
                  name="password"
                  ref={register({ required: 'Password is required' })}
                />
              </Forms.Field>

              <Button type="submit">Sign Up</Button>
            </>
          )}
        </Forms.Form>
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, {}, StoreState> = (state: StoreState) => ({
  code: state.location.routeParams.code,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, {}> = {
  updateLocation,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(SingupInvitedPageUnconnected));
