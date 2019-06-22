import React, { ChangeEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { getBackendSrv } from '@grafana/runtime';
import { OrgUser, StoreState } from 'app/types';
import { updateUser } from './state/actions';
import { Input, Button, FormLabel } from '@grafana/ui';

export interface Props {
  adminMode?: boolean;
  userId?: number;
  user: OrgUser;
  updateUser: typeof updateUser;
}
export interface State {
  mode: string;
  name: string;
  email: string;
  login: string;
  password: string;
}

export class UserProfile extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { user, userId, adminMode } = props;
    const { name, email, login } = user;
    let mode = '';

    if (adminMode && userId) {
      mode = 'edit';
    } else if (adminMode) {
      mode = 'new';
    } else {
      mode = 'profile';
    }

    this.state = {
      mode,
      name,
      email,
      login,
      password: '',
    };
  }

  pageHeader() {
    const { mode } = this.state;
    let header: string;

    switch (mode) {
      case 'edit':
        header = 'Edit User';
        break;
      case 'new':
        header = 'Add New User';
        break;
      case 'new':
        header = 'Edit Profile';
        break;
    }

    return header;
  }

  onNameChange = (name: string) => {
    this.setState({ name });
  };

  onEmailChange = (email: string) => {
    this.setState({ email });
  };

  onLoginChange = (login: string) => {
    this.setState({ login });
  };

  onPasswordChange = (password: string) => {
    this.setState({ password });
  };

  async onCreateUser() {
    const { name, email, login, password } = this.state;

    await getBackendSrv().post('/api/admin/users', {
      name,
      email,
      login,
      password,
    });
  }

  async onUpdateUser() {
    const { userId } = this.props;
    const { name, email, login } = this.state;
    await this.props.updateUser(
      {
        name,
        email,
        login,
      },
      userId
    );
  }

  render() {
    const { email, name, login, password, mode } = this.state;
    return (
      <>
        <h3 className="page-sub-heading">{this.pageHeader()}</h3>
        <form name="profileForm" className="gf-form-group">
          <div className="gf-form max-width-30">
            <FormLabel className="width-8">Name</FormLabel>
            <Input
              className="gf-form-input max-width-22"
              type="text"
              onChange={(event: ChangeEvent<HTMLInputElement>) => this.onNameChange(event.target.value)}
              value={name}
            />
          </div>
          <div className="gf-form max-width-30">
            <FormLabel className="width-8">Email</FormLabel>
            <Input
              className="gf-form-input max-width-22"
              type="text"
              onChange={(event: ChangeEvent<HTMLInputElement>) => this.onEmailChange(event.target.value)}
              value={email}
            />
          </div>
          <div className="gf-form max-width-30">
            <FormLabel className="width-8">Username</FormLabel>
            <Input
              className="gf-form-input max-width-22"
              type="text"
              onChange={(event: ChangeEvent<HTMLInputElement>) => this.onLoginChange(event.target.value)}
              value={login}
            />
          </div>
          {mode === 'new' && (
            <div className="gf-form max-width-30">
              <FormLabel className="width-8">Password</FormLabel>
              <Input
                className="gf-form-input max-width-22"
                type="password"
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onPasswordChange(event.target.value)}
                value={password}
              />
            </div>
          )}
          <div className="gf-form-button-row">
            <Button
              onClick={event => {
                event.preventDefault();
                if (mode === 'new') {
                  this.onCreateUser();
                } else {
                  this.onUpdateUser();
                }
              }}
            >
              Save
            </Button>
          </div>
        </form>
      </>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    user: state.user.profile,
  };
}

const mapDispatchToProps = {
  updateUser,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserProfile)
);
