import React, { ChangeEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
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

  onNameChange = (name: string) => {
    this.setState({ name });
  };

  onEmailChange = (email: string) => {
    this.setState({ email });
  };

  onLoginChange = (login: string) => {
    this.setState({ login });
  };

  onUpdateUser = () => {
    const { userId } = this.props;
    const { name, email, login } = this.state;
    this.props.updateUser(
      {
        name,
        email,
        login,
      },
      userId
    );
  };

  render() {
    const { adminMode } = this.props;
    const { email, name, login } = this.state;
    return (
      <>
        <h3 className="page-sub-heading">{adminMode ? 'Edit User' : 'Edit Profile'}</h3>
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
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserProfile)
);
