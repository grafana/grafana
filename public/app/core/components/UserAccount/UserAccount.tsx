import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { OrgUser, StoreState } from 'app/types';
import Page from 'app/core/components/Page/Page';
import UserProfile from './UserProfile';
import { loadUserProfile, setUserName, setUserEmail, setUserLogin, updateUserProfile } from './state/actions';
import { getRouteParamsId } from 'app/core/selectors/location';

export interface Props {
  isAdmin?: boolean;
  uid?: number;
  user: OrgUser;
  loadUserProfile: typeof loadUserProfile;
  setUserName: typeof setUserName;
  setUserEmail: typeof setUserEmail;
  setUserLogin: typeof setUserLogin;
  updateUserProfile: typeof updateUserProfile;
}

export class UserAccount extends PureComponent<Props> {
  async componentDidMount() {
    const { uid } = this.props;
    await this.props.loadUserProfile(uid);
  }

  onNameChange = name => {
    this.props.setUserName(name);
  };

  onEmailChange = email => {
    this.props.setUserEmail(email);
  };

  onLoginChange = login => {
    this.props.setUserLogin(login);
  };

  onUpdateUser = () => {
    const { uid } = this.props;
    this.props.updateUserProfile(uid);
  };

  render() {
    const { user, isAdmin } = this.props;
    const isLoading = Object.keys(user).length === 0;
    return (
      <>
        <Page.Contents isLoading={isLoading}>
          {!isLoading && (
            <UserProfile
              adminMode={isAdmin}
              name={user.name}
              email={user.email}
              login={user.login}
              onNameChange={name => this.onNameChange(name)}
              onEmailChange={email => this.onEmailChange(email)}
              onLoginChange={login => this.onLoginChange(login)}
              onSubmit={this.onUpdateUser}
            />
          )}
        </Page.Contents>
      </>
    );
  }
}

function mapStateToProps(state: StoreState) {
  const userId = getRouteParamsId(state.location);
  return {
    uid: userId ? userId : null,
    user: state.userAccount.userProfile,
  };
}

const mapDispatchToProps = {
  loadUserProfile,
  setUserName,
  setUserEmail,
  setUserLogin,
  updateUserProfile,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserAccount)
);
