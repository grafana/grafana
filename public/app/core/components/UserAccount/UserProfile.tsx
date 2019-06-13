import React, { ChangeEvent, PureComponent } from 'react';
import { OrgUser } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { Input, Button } from '@grafana/ui';

export interface Props {
  adminMode: boolean;
  uid: number;
}

export interface State {
  user: OrgUser;
}

export class UserProfile extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      user: {} as OrgUser,
    };
  }

  componentDidMount() {
    this.loadUserProfile();
  }

  onNameChange = name => {
    this.setState({ user: { ...this.state.user, name } });
  };

  onEmailChange = email => {
    this.setState({ user: { ...this.state.user, email } });
  };

  onLoginChange = login => {
    this.setState({ user: { ...this.state.user, login } });
  };

  loadUserProfile = async () => {
    const { uid } = this.props;
    let profileResponse;

    if (uid) {
      profileResponse = await getBackendSrv().get('/api/users/' + uid);
    } else {
      profileResponse = await getBackendSrv().get('/api/user');
    }

    this.setState({ user: profileResponse });
  };

  updateUserProfile = async () => {
    const { uid } = this.props;
    const { user } = this.state;

    if (uid) {
      await getBackendSrv().put('/api/users/' + uid, user);
    } else {
      await getBackendSrv().put('/api/user/', user);
    }

    this.loadUserProfile();
  };

  render() {
    const { adminMode } = this.props;
    const { user } = this.state;
    const isLoading = Object.keys(user).length === 0;
    return (
      <>
        <h3 className="page-sub-heading">{adminMode ? 'Edit User' : 'Edit Profile'}</h3>
        {!isLoading && (
          <form name="profileForm" className="gf-form-group">
            <div className="gf-form max-width-30">
              <span className="gf-form-label width-8">Name</span>
              <Input
                className="gf-form-input max-width-22"
                type="text"
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onNameChange(event.target.value)}
                value={user.name}
              />
            </div>
            <div className="gf-form max-width-30">
              <span className="gf-form-label width-8">Email</span>
              <Input
                className="gf-form-input max-width-22"
                type="text"
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onEmailChange(event.target.value)}
                value={user.email}
              />
            </div>
            <div className="gf-form max-width-30">
              <span className="gf-form-label width-8">Username</span>
              <Input
                className="gf-form-input max-width-22"
                type="text"
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onLoginChange(event.target.value)}
                value={user.login}
              />
            </div>
            <div className="gf-form-button-row">
              <Button
                onClick={event => {
                  event.preventDefault();
                  this.updateUserProfile();
                }}
              >
                Save
              </Button>
            </div>
          </form>
        )}
      </>
    );
  }
}

export default UserProfile;
