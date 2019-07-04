import React, { PureComponent, ChangeEvent, MouseEvent } from 'react';
import { Button, FormLabel, Input } from '@grafana/ui';
import { User } from 'app/types';
import { ProfileUpdateFields } from 'app/core/utils/UserProvider';

export interface Props {
  user: User;
  isSavingUser: boolean;
  updateProfile: (payload: ProfileUpdateFields) => void;
}

export interface State {
  name: string;
  email: string;
  login: string;
}

export class UserProfileEditForm extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { user } = props;
    const { name, email, login } = user;

    this.state = {
      name,
      email,
      login,
    };
  }

  onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ name: event.target.value });
  };

  onEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ email: event.target.value });
  };

  onLoginChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ login: event.target.value });
  };

  onSubmitProfileUpdate = (event: MouseEvent<HTMLInputElement>) => {
    event.preventDefault();
    const { name, email, login } = this.state;
    this.props.updateProfile({ name, email, login });
  };

  render() {
    const { name, email, login } = this.state;
    const { isSavingUser } = this.props;

    return (
      <>
        <h3 className="page-sub-heading">Edit Profile</h3>
        <form name="userForm" className="gf-form-group">
          <div className="gf-form max-width-30">
            <FormLabel className="width-8">Name</FormLabel>
            <Input className="gf-form-input max-width-22" type="text" onChange={this.onNameChange} value={name} />
          </div>
          <div className="gf-form max-width-30">
            <FormLabel className="width-8">Email</FormLabel>
            <Input className="gf-form-input max-width-22" type="text" onChange={this.onEmailChange} value={email} />
          </div>
          <div className="gf-form max-width-30">
            <FormLabel className="width-8">Username</FormLabel>
            <Input className="gf-form-input max-width-22" type="text" onChange={this.onLoginChange} value={login} />
          </div>
          <div className="gf-form-button-row">
            <Button variant="primary" onClick={this.onSubmitProfileUpdate} disabled={isSavingUser}>
              Save
            </Button>
          </div>
        </form>
      </>
    );
  }
}

export default UserProfileEditForm;
