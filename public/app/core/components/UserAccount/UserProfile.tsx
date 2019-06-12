import React, { ChangeEvent, FC } from 'react';
import { Input } from '@grafana/ui';

export interface Props {
  adminMode: boolean;
  name: string;
  email: string;
  login: string;
  onSubmit: () => void;
  onNameChange: (name: string) => void;
  onEmailChange: (email: string) => void;
  onLoginChange: (login: string) => void;
}

const UserProfile: FC<Props> = ({
  onSubmit,
  onNameChange,
  onEmailChange,
  onLoginChange,
  name,
  email,
  login,
  adminMode,
}) => {
  return (
    <>
      <h3 className="page-sub-heading">{adminMode ? 'Edit User' : 'Edit Profile'}</h3>
      <form
        name="profileForm"
        className="gf-form-group"
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="gf-form max-width-30">
          <span className="gf-form-label width-8">Name</span>
          <Input
            className="gf-form-input max-width-22"
            type="text"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onNameChange(event.target.value)}
            value={name}
          />
        </div>
        <div className="gf-form max-width-30">
          <span className="gf-form-label width-8">Email</span>
          <Input
            className="gf-form-input max-width-22"
            type="text"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onEmailChange(event.target.value)}
            value={email}
          />
        </div>
        <div className="gf-form max-width-30">
          <span className="gf-form-label width-8">Username</span>
          <Input
            className="gf-form-input max-width-22"
            type="text"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onLoginChange(event.target.value)}
            value={login}
          />
        </div>
        <div className="gf-form-button-row">
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </>
  );
};

export default UserProfile;
