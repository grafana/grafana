import React, { FC, useState } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { updateLocation } from 'app/core/actions';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, Form, Input } from '@grafana/ui';
import { useAsync } from 'react-use';
import Page from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { getConfig } from 'app/core/config';
import { UrlQueryValue } from '@grafana/data';

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
    icon: 'grafana',
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
        <Form defaultValues={initFormModel} onSubmit={onSubmit}>
          {({ register, errors }) => (
            <>
              <Field invalid={!!errors.email} error={errors.email && errors.email.message} label="Email">
                <Input
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
              </Field>
              <Field invalid={!!errors.name} error={errors.name && errors.name.message} label="Name">
                <Input placeholder="Name (optional)" name="name" ref={register} />
              </Field>
              <Field invalid={!!errors.username} error={errors.username && errors.username.message} label="Username">
                <Input placeholder="Username" name="username" ref={register({ required: 'Username is required' })} />
              </Field>
              <Field invalid={!!errors.password} error={errors.password && errors.password.message} label="Password">
                <Input
                  type="password"
                  placeholder="Password"
                  name="password"
                  ref={register({ required: 'Password is required' })}
                />
              </Field>

              <Button type="submit">Sign Up</Button>
            </>
          )}
        </Form>
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
