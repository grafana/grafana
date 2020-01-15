import React, { useState } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { Forms } from '@grafana/ui';
import { NavModel } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { StoreState } from '../../types';
import { getNavModel } from '../../core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { updateLocation } from 'app/core/actions';

interface UserCreatePageProps {
  navModel: NavModel;
  updateLocation: typeof updateLocation;
}

interface UserDTO {
  name: string;
  password: string;
  email?: string;
  login?: string;
}

const createUser = async (user: UserDTO) => getBackendSrv().post('/api/admin/users', user);

const UserCreatePage: React.FC<UserCreatePageProps> = ({ navModel, updateLocation }) => {
  const [name, setName] = useState();
  const [email, setEmail] = useState();
  const [username, setUsername] = useState();
  const [password, setPassword] = useState();

  const [state, submit] = useAsyncFn(async () => {
    await createUser({
      name,
      password,
      email,
      login: username,
    });

    updateLocation({ path: '/admin/users' });
  }, [name, password, email, username]);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h1>Add new user</h1>
        <div>{JSON.stringify(state)}</div>

        <Forms.Field label="Name">
          <Forms.Input size="md" value={name || ''} onChange={e => setName(e.currentTarget.value)} />
        </Forms.Field>
        <Forms.Field label="E-mail">
          <Forms.Input size="md" value={email || ''} onChange={e => setEmail(e.currentTarget.value)} />
        </Forms.Field>
        <Forms.Field label="Username">
          <Forms.Input size="md" value={username || ''} onChange={e => setUsername(e.currentTarget.value)} />
        </Forms.Field>
        <Forms.Field label="Password">
          <Forms.Input
            size="md"
            type="password"
            value={password || ''}
            onChange={e => setPassword(e.currentTarget.value)}
          />
        </Forms.Field>
        <Forms.Button onClick={() => submit()}>Create user</Forms.Button>
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'global-users'),
});

const mapDispatchToProps = {
  updateLocation,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UserCreatePage));
