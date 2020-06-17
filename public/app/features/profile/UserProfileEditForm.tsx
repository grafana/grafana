import React, { FC } from 'react';
import { Button, Tooltip, Icon, Form, Input, Field, FieldSet } from '@grafana/ui';
import { User } from 'app/types';
import config from 'app/core/config';
import { ProfileUpdateFields } from 'app/core/utils/UserProvider';

export interface Props {
  user: User;
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
          <FieldSet label="Edit Profile">
            <Field label="Name" invalid={!!errors.name} error="Name is required">
              <Input name="name" ref={register({ required: true })} placeholder="Name" defaultValue={user.name} />
            </Field>
            <Field label="Email" invalid={!!errors.email} error="Email is required" disabled={disableLoginForm}>
              <Input
                name="email"
                ref={register({ required: true })}
                placeholder="Email"
                defaultValue={user.email}
                suffix={<InputSuffix />}
              />
            </Field>
            <Field label="Username" disabled={disableLoginForm}>
              <Input
                name="login"
                ref={register}
                defaultValue={user.login}
                placeholder="Username"
                suffix={<InputSuffix />}
              />
            </Field>
            <div className="gf-form-button-row">
              <Button variant="primary" disabled={isSavingUser}>
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
    <Tooltip content="Login Details Locked - managed in another system.">
      <Icon name="lock" />
    </Tooltip>
  ) : null;
};
