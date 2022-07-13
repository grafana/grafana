import { Trans, t } from '@lingui/macro';
import React, { FC } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Field, FieldSet, Form, Icon, Input, Tooltip } from '@grafana/ui';
import config from 'app/core/config';
import { UserDTO } from 'app/types';

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

  // check if authLabels is longer than 0 otherwise false
  const isExternalUser: boolean = (user && user.isExternal) ?? false;
  const authSource = isExternalUser && user && user.authLabels ? user.authLabels[0] : '';
  const lockMessage = authSource ? ` (Synced via ${authSource})` : '';
  const disabledEdit = disableLoginForm || isExternalUser;

  return (
    <Form onSubmit={onSubmitProfileUpdate} validateOn="onBlur">
      {({ register, errors }) => {
        return (
          <FieldSet label={<Trans id="user-profile.title">Edit profile</Trans>}>
            <Field
              label={t({ id: 'user-profile.fields.name-label', message: 'Name' }) + lockMessage}
              invalid={!!errors.name}
              error={<Trans id="user-profile.fields.name-error">Name is required</Trans>}
              disabled={disabledEdit}
            >
              <Input
                {...register('name', { required: true })}
                id="edit-user-profile-name"
                placeholder={t({ id: 'user-profile.fields.name-label', message: 'Name' })}
                defaultValue={user?.name ?? ''}
                suffix={<InputSuffix />}
              />
            </Field>

            <Field
              label={t({ id: 'user-profile.fields.email-label', message: 'Email' }) + lockMessage}
              invalid={!!errors.email}
              error={<Trans id="user-profile.fields.email-error">Email is required</Trans>}
              disabled={disabledEdit}
            >
              <Input
                {...register('email', { required: true })}
                id="edit-user-profile-email"
                placeholder={t({ id: 'user-profile.fields.email-label', message: 'Email' })}
                defaultValue={user?.email ?? ''}
                suffix={<InputSuffix />}
              />
            </Field>

            <Field
              label={t({ id: 'user-profile.fields.username-label', message: 'Username' }) + lockMessage}
              disabled={disabledEdit}
            >
              <Input
                {...register('login')}
                id="edit-user-profile-username"
                defaultValue={user?.login ?? ''}
                placeholder={t({ id: 'user-profile.fields.username-label', message: 'Username' }) + lockMessage}
                suffix={<InputSuffix />}
              />
            </Field>

            <div className="gf-form-button-row">
              <Button
                variant="primary"
                disabled={isSavingUser || disabledEdit}
                data-testid={selectors.components.UserProfile.profileSaveButton}
                type="submit"
              >
                <Trans id="common.save">Save</Trans>
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
