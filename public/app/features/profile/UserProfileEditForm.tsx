import React, { FC } from 'react';
import { Button, Form, Field, Input, Tooltip, Icon, Legend } from '@grafana/ui';
import { User } from 'app/types';
import config from 'app/core/config';
import { ProfileUpdateFields } from 'app/core/utils/UserProvider';

export interface Props {
  user: User;
  isSavingUser: boolean;
  updateProfile: (payload: ProfileUpdateFields) => void;
}

interface UserDTO {
  name: string;
  email: string;
  login: string;
}

export const UserProfileEditForm: FC<Props> = ({ user, isSavingUser, updateProfile }) => {
  const { disableLoginForm } = config;

  return (
    <>
      <Legend>Edit Profile</Legend>
      <Form
        defaultValues={user}
        onSubmit={(user: UserDTO) => {
          updateProfile({ ...user });
        }}
      >
        {({ register, errors }) => (
          <>
            <Field label="Name" invalid={!!errors.name}>
              <Input ref={register} type="text" name="name" />
            </Field>

            <Field
              label="Email"
              invalid={!!errors.email}
              disabled={disableLoginForm}
              description={disableLoginForm && 'Login Details Locked - managed in another system.'}
            >
              <Input
                prefix={disableLoginForm && <Icon name="lock" />}
                placeholder="user@email.com"
                ref={register}
                type="email"
                name="email"
              />
            </Field>

            <Field
              label="Username"
              disabled={disableLoginForm}
              description={disableLoginForm && 'Login Details Locked - managed in another system.'}
            >
              <Input prefix={disableLoginForm && <Icon name="lock" />} ref={register} type="text" name="login" />
            </Field>
            <Button type="submit">Save</Button>
          </>
        )}
      </Form>
    </>
  );
};

export default UserProfileEditForm;
