import React, { useCallback } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { Forms, Button } from '@grafana/ui';
import { NavModel } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { StoreState } from '../../types';
import { getNavModel } from '../../core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
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
  const onSubmit = useCallback(async (data: UserDTO) => {
    await createUser(data);
    updateLocation({ path: '/admin/users' });
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h1>Add new user</h1>
        <Forms.Form onSubmit={onSubmit} validateOn="onBlur">
          {({ register, errors }) => {
            return (
              <>
                <Forms.Field label="Name" required invalid={!!errors.name} error={!!errors.name && 'Name is required'}>
                  <Forms.Input name="name" size="md" ref={register({ required: true })} />
                </Forms.Field>

                <Forms.Field label="E-mail">
                  <Forms.Input name="email" size="md" ref={register} />
                </Forms.Field>

                <Forms.Field label="Username">
                  <Forms.Input name="login" size="md" ref={register} />
                </Forms.Field>
                <Forms.Field
                  label="Password"
                  required
                  invalid={!!errors.password}
                  error={!!errors.password && 'Password is required and must contain at least 4 characters'}
                >
                  <Forms.Input
                    size="md"
                    type="password"
                    name="password"
                    ref={register({
                      validate: value => value.trim() !== '' && value.length >= 4,
                    })}
                  />
                </Forms.Field>
                <Button type="submit">Create user</Button>
              </>
            );
          }}
        </Forms.Form>
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
