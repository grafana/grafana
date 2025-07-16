import { css, cx } from '@emotion/css';
import { PureComponent, useRef, useState } from 'react';
import * as React from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, ConfirmButton, ConfirmModal, Input, LegacyInputStatus, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
import { UserDTO } from 'app/types/user';

interface Props {
  user: UserDTO;

  onUserUpdate: (user: UserDTO) => void;
  onUserDelete: (userUid: string) => void;
  onUserDisable: (userUid: string) => void;
  onUserEnable: (userUid: string) => void;
  onPasswordChange(password: string): void;
}

export function UserProfile({
  user,
  onUserUpdate,
  onUserDelete,
  onUserDisable,
  onUserEnable,
  onPasswordChange,
}: Props) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);

  const deleteUserRef = useRef<HTMLButtonElement | null>(null);
  const showDeleteUserModal = (show: boolean) => () => {
    setShowDeleteModal(show);
    if (!show && deleteUserRef.current) {
      deleteUserRef.current.focus();
    }
  };

  const disableUserRef = useRef<HTMLButtonElement | null>(null);
  const showDisableUserModal = (show: boolean) => () => {
    setShowDisableModal(show);
    if (!show && disableUserRef.current) {
      disableUserRef.current.focus();
    }
  };

  const handleUserDelete = () => onUserDelete(user.uid);

  const handleUserDisable = () => onUserDisable(user.uid);

  const handleUserEnable = () => onUserEnable(user.uid);

  const onUserNameChange = (newValue: string) => {
    onUserUpdate({
      ...user,
      name: newValue,
    });
  };

  const onUserEmailChange = (newValue: string) => {
    onUserUpdate({
      ...user,
      email: newValue,
    });
  };

  const onUserLoginChange = (newValue: string) => {
    onUserUpdate({
      ...user,
      login: newValue,
    });
  };

  let authSource = user.authLabels?.length && user.authLabels[0];
  if (user.isProvisioned) {
    authSource = 'SCIM';
  }
  const lockMessage = authSource ? `Synced via ${authSource}` : '';

  const editLocked =
    user.isExternal || user.isProvisioned || !contextSrv.hasPermissionInMetadata(AccessControlAction.UsersWrite, user);
  const passwordChangeLocked =
    user.isExternal ||
    user.isProvisioned ||
    !contextSrv.hasPermissionInMetadata(AccessControlAction.UsersPasswordUpdate, user);
  const canDelete = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDelete, user);
  const canDisable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDisable, user);
  const canEnable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersEnable, user);

  return (
    <div>
      <h3 className="page-heading">
        <Trans i18nKey="admin.user-profile.title">User information</Trans>
      </h3>
      <Stack direction="column" gap={1.5}>
        <div>
          <table className="filter-table form-inline">
            <tbody>
              <UserProfileRow
                label={t('admin.user-profile.label-numerical-identifier', 'Numerical identifier')}
                value={user.id.toString()}
                locked={true}
              />
              <UserProfileRow
                label={t('admin.user-profile.label-name', 'Name')}
                value={user.name}
                locked={editLocked}
                lockMessage={lockMessage}
                onChange={onUserNameChange}
              />
              <UserProfileRow
                label={t('admin.user-profile.label-email', 'Email')}
                value={user.email}
                locked={editLocked}
                lockMessage={lockMessage}
                onChange={onUserEmailChange}
              />
              <UserProfileRow
                label={t('admin.user-profile.label-username', 'Username')}
                value={user.login}
                locked={editLocked}
                lockMessage={lockMessage}
                onChange={onUserLoginChange}
              />
              <UserProfileRow
                label={t('admin.user-profile.label-password', 'Password')}
                value="********"
                inputType="password"
                locked={passwordChangeLocked}
                lockMessage={lockMessage}
                onChange={onPasswordChange}
              />
            </tbody>
          </table>
        </div>
        <Stack gap={2}>
          {canDelete && (
            <>
              <Button variant="destructive" onClick={showDeleteUserModal(true)} ref={deleteUserRef}>
                <Trans i18nKey="admin.user-profile.delete-button">Delete user</Trans>
              </Button>
              <ConfirmModal
                isOpen={showDeleteModal}
                title={t('admin.user-profile.title-delete-user', 'Delete user')}
                body={t('admin.user-profile.body-delete', 'Are you sure you want to delete this user?')}
                confirmText={t('admin.user-profile.confirmText-delete-user', 'Delete user')}
                onConfirm={handleUserDelete}
                onDismiss={showDeleteUserModal(false)}
              />
            </>
          )}
          {user.isDisabled && canEnable && (
            <Button variant="secondary" onClick={handleUserEnable}>
              <Trans i18nKey="admin.user-profile.enable-button">Enable user</Trans>
            </Button>
          )}
          {!user.isDisabled && canDisable && (
            <>
              <Button variant="secondary" onClick={showDisableUserModal(true)} ref={disableUserRef}>
                <Trans i18nKey="admin.user-profile.disable-button">Disable user</Trans>
              </Button>
              <ConfirmModal
                isOpen={showDisableModal}
                title={t('admin.user-profile.title-disable-user', 'Disable user')}
                body={t('admin.user-profile.body-disable', 'Are you sure you want to disable this user?')}
                confirmText={t('admin.user-profile.confirmText-disable-user', 'Disable user')}
                onConfirm={handleUserDisable}
                onDismiss={showDisableUserModal(false)}
              />
            </>
          )}
        </Stack>
      </Stack>
    </div>
  );
}

interface UserProfileRowProps {
  label: string;
  value?: string;
  locked?: boolean;
  lockMessage?: string;
  inputType?: string;
  onChange?: (value: string) => void;
}

interface UserProfileRowState {
  value: string;
  editing: boolean;
}

export class UserProfileRow extends PureComponent<UserProfileRowProps, UserProfileRowState> {
  inputElem?: HTMLInputElement;

  static defaultProps: Partial<UserProfileRowProps> = {
    value: '',
    locked: false,
    lockMessage: '',
    inputType: 'text',
  };

  state = {
    editing: false,
    value: this.props.value || '',
  };

  setInputElem = (elem: HTMLInputElement) => {
    this.inputElem = elem;
  };

  onEditClick = () => {
    if (this.props.inputType === 'password') {
      // Reset value for password field
      this.setState({ editing: true, value: '' }, this.focusInput);
    } else {
      this.setState({ editing: true }, this.focusInput);
    }
  };

  onCancelClick = () => {
    this.setState({ editing: false, value: this.props.value || '' });
  };

  onInputChange = (event: React.ChangeEvent<HTMLInputElement>, status?: LegacyInputStatus) => {
    if (status === LegacyInputStatus.Invalid) {
      return;
    }

    this.setState({
      value: event.target.value,
    });
  };

  onInputBlur = (event: React.FocusEvent<HTMLInputElement>, status?: LegacyInputStatus) => {
    if (status === LegacyInputStatus.Invalid) {
      return;
    }

    this.setState({
      value: event.target.value,
    });
  };

  focusInput = () => {
    if (this.inputElem && this.inputElem.focus) {
      this.inputElem.focus();
    }
  };

  onSave = () => {
    if (this.props.onChange) {
      this.props.onChange(this.state.value);
    }
  };

  render() {
    const { label, locked, lockMessage, inputType } = this.props;
    const { value } = this.state;
    const labelClass = cx(
      'width-16',
      css({
        fontWeight: 500,
      })
    );

    if (locked) {
      return <LockedRow label={label} value={value} lockMessage={lockMessage} />;
    }

    const inputId = `${label}-input`;
    return (
      <tr>
        <td className={labelClass}>
          <label htmlFor={inputId}>{label}</label>
        </td>
        <td className="width-25" colSpan={2}>
          {this.state.editing ? (
            <Input
              id={inputId}
              type={inputType}
              defaultValue={value}
              onBlur={this.onInputBlur}
              onChange={this.onInputChange}
              ref={this.setInputElem}
              width={30}
            />
          ) : (
            <span>{this.props.value}</span>
          )}
        </td>
        <td>
          <ConfirmButton
            confirmText={t('admin.user-profile-row.confirmText-save', 'Save')}
            onClick={this.onEditClick}
            onConfirm={this.onSave}
            onCancel={this.onCancelClick}
          >
            {t('admin.user-profile.edit-button', 'Edit')}
          </ConfirmButton>
        </td>
      </tr>
    );
  }
}

interface LockedRowProps {
  label: string;
  value?: string;
  lockMessage?: string;
}

export const LockedRow = ({ label, value, lockMessage }: LockedRowProps) => {
  const lockMessageClass = css({
    fontStyle: 'italic',
    marginRight: '0.6rem',
  });
  const labelClass = cx(
    'width-16',
    css({
      fontWeight: 500,
    })
  );

  return (
    <tr>
      <td className={labelClass}>{label}</td>
      <td className="width-25" colSpan={2}>
        {value}
      </td>
      <td>
        <span className={lockMessageClass}>{lockMessage}</span>
      </td>
    </tr>
  );
};
