import React, { ChangeEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { Input } from '@grafana/ui';
import { OrgUser, StoreState } from 'app/types';
import { loadUserProfile, setUserName, setUserEmail, setUserLogin, updateUserProfile } from './state/actions';

export interface Props {
  user: OrgUser;
  loadUserProfile: typeof loadUserProfile;
  setUserName: typeof setUserName;
  setUserEmail: typeof setUserEmail;
  setUserLogin: typeof setUserLogin;
  updateUserProfile: typeof updateUserProfile;
}

export class UserProfile extends PureComponent<Props> {
  async componentDidMount() {
    await this.props.loadUserProfile();
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

  onSubmit = () => {
    this.props.updateUserProfile();
  };

  render() {
    const { user } = this.props;
    const loaded = Object.keys(user).length > 0;
    return (
      <>
        <h3 className="page-sub-heading">User Profile</h3>
        {loaded && (
          <form
            name="profileForm"
            className="gf-form-group"
            onSubmit={event => {
              event.preventDefault();
              this.onSubmit();
            }}
          >
            <div className="gf-form">
              <span className="gf-form-label width-10">Name</span>
              <Input
                className="gf-form-input max-width-25"
                type="text"
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onNameChange(event.target.value)}
                value={user.name}
              />
            </div>
            <div className="gf-form">
              <span className="gf-form-label width-10">Email</span>
              <Input
                className="gf-form-input max-width-25"
                type="text"
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onEmailChange(event.target.value)}
                value={user.email}
              />
            </div>
            <div className="gf-form">
              <span className="gf-form-label width-10">Username</span>
              <Input
                className="gf-form-input max-width-25"
                type="text"
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onLoginChange(event.target.value)}
                value={user.login}
              />
            </div>
            <div className="gf-form-button-row">
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        )}
      </>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    user: state.user.userProfile,
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
  )(UserProfile)
);
