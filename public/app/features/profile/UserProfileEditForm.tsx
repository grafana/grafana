import React, { FC } from 'react';
import { Trans } from '@lingui/macro';
import { Button, Field, FieldSet, Form, Icon, Input, Tooltip } from '@grafana/ui';
import { UserDTO } from 'app/types';
import config from 'app/core/config';
import { ProfileUpdateFields } from './types';

export interface Props {
  user: UserDTO | null;
  isSavingUser: boolean;
  updateProfile: (payload: ProfileUpdateFields) => void;
}

const { disableLoginForm } = config;

export const UserProfileEditForm: FC<Props> = ({ user, isSavingUser, updateProfile }) => {
  const onSubmitProfileUpdate = (data: ProfileUpdateFields) => {
    updateProfile(data);
  };

  return (
    <Form onSubmit={onSubmitProfileUpdate} validateOn="onBlur">
      {({ register, errors }) => {
        return (
          <FieldSet label={<Trans id="edit-user-profile.title">Edit profile</Trans>}>
            <Field label="Name" invalid={!!errors.name} error="Name is required" disabled={disableLoginForm}>
              <Input
                {...register('name', { required: true })}
                id="edit-user-profile-name"
                placeholder="Name"
                defaultValue={user?.name ?? ''}
                suffix={<InputSuffix />}
              />
            </Field>
            <Field label="Email" invalid={!!errors.email} error="Email is required" disabled={disableLoginForm}>
              <Input
                {...register('email', { required: true })}
                id="edit-user-profile-email"
                placeholder="Email"
                defaultValue={user?.email ?? ''}
                suffix={<InputSuffix />}
              />
            </Field>
            <Field label="Username" disabled={disableLoginForm}>
              <Input
                {...register('login')}
                id="edit-user-profile-username"
                defaultValue={user?.login ?? ''}
                placeholder="Username"
                suffix={<InputSuffix />}
              />
            </Field>
            <div className="gf-form-button-row">
              <Button variant="primary" disabled={isSavingUser} aria-label="Edit user profile save button">
                Save
              </Button>
            </div>
          </FieldSet>
        );
      }}
    </Form>
  );
};

export default UserProfileEditForm;

const InputSuffix: FC = () => {
  return disableLoginForm ? (
    <Tooltip content="Login details locked because they are managed in another system.">
      <Icon name="lock" />
    </Tooltip>
  ) : null;
};
