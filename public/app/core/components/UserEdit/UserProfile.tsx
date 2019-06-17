import React, { ChangeEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { OrgUser, StoreState } from 'app/types';
import { Input, Button } from '@grafana/ui';
import { setUserName, setUserEmail, setUserLogin, updateUser } from './state/actions';

export interface Props {
  adminMode: boolean;
  uid: number;
  user: OrgUser;
  setUserName: typeof setUserName;
  setUserEmail: typeof setUserEmail;
  setUserLogin: typeof setUserLogin;
  updateUser: typeof updateUser;
}

export interface State {
  name: string;
  email: string;
  login: string;
}

export class UserProfile extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { user } = props;
    this.state = {
      name: user.name,
      email: user.email,
      login: user.login,
    };
  }

  onNameChange = name => {
    this.setState({ name });
  };

  onEmailChange = email => {
    this.setState({ email });
  };

  onLoginChange = login => {
    this.setState({ login });
  };

  onUpdateUser = () => {
    const { uid } = this.props;
    const { name, email, login } = this.state;
    this.props.setUserName(name);
    this.props.setUserEmail(email);
    this.props.setUserLogin(login);
    this.props.updateUser(uid);
  };

  render() {
    const { adminMode } = this.props;
    const { email, name, login } = this.state;
    return (
      <>
        <h3 className="page-sub-heading">{adminMode ? 'Edit User' : 'Edit Profile'}</h3>
        <form name="profileForm" className="gf-form-group">
          <div className="gf-form max-width-30">
            <span className="gf-form-label width-8">Name</span>
            <Input
              className="gf-form-input max-width-22"
              type="text"
              onChange={(event: ChangeEvent<HTMLInputElement>) => this.onNameChange(event.target.value)}
              value={name}
            />
          </div>
          <div className="gf-form max-width-30">
            <span className="gf-form-label width-8">Email</span>
            <Input
              className="gf-form-input max-width-22"
              type="text"
              onChange={(event: ChangeEvent<HTMLInputElement>) => this.onEmailChange(event.target.value)}
              value={email}
            />
          </div>
          <div className="gf-form max-width-30">
            <span className="gf-form-label width-8">Username</span>
            <Input
              className="gf-form-input max-width-22"
              type="text"
              onChange={(event: ChangeEvent<HTMLInputElement>) => this.onLoginChange(event.target.value)}
              value={login}
            />
          </div>
          <div className="gf-form-button-row">
            <Button
              onClick={event => {
                event.preventDefault();
                this.onUpdateUser();
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
  setUserName,
  setUserEmail,
  setUserLogin,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserProfile)
);
