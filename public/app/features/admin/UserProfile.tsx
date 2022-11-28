import { css, cx } from '@emotion/css';
import React, { FC, PureComponent, useRef, useState } from 'react';

import { Button, ConfirmButton, ConfirmModal, Input, LegacyInputStatus } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, UserDTO } from 'app/types';

interface Props {
  user: UserDTO;

  onUserUpdate: (user: UserDTO) => void;
  onUserDelete: (userId: number) => void;
  onUserDisable: (userId: number) => void;
  onUserEnable: (userId: number) => void;
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

  const handleUserDelete = () => onUserDelete(user.id);

  const handleUserDisable = () => onUserDisable(user.id);

  const handleUserEnable = () => onUserEnable(user.id);

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

  const authSource = user.authLabels?.length && user.authLabels[0];
  const lockMessage = authSource ? `Synced via ${authSource}` : '';

  const editLocked = user.isExternal || !contextSrv.hasPermissionInMetadata(AccessControlAction.UsersWrite, user);
  const passwordChangeLocked =
    user.isExternal || !contextSrv.hasPermissionInMetadata(AccessControlAction.UsersPasswordUpdate, user);
  const canDelete = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDelete, user);
  const canDisable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDisable, user);
  const canEnable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersEnable, user);

  return (
    <>
      <h3 className="page-heading">User information</h3>
      <div className="gf-form-group">
        <div className="gf-form">
          <table className="filter-table form-inline">
            <tbody>
              <UserProfileRow
                label="Name"
                value={user.name}
                locked={editLocked}
                lockMessage={lockMessage}
                onChange={onUserNameChange}
              />
              <UserProfileRow
                label="Email"
                value={user.email}
                locked={editLocked}
                lockMessage={lockMessage}
                onChange={onUserEmailChange}
              />
              <UserProfileRow
                label="Username"
                value={user.login}
                locked={editLocked}
                lockMessage={lockMessage}
                onChange={onUserLoginChange}
              />
              <UserProfileRow
                label="Password"
                value="********"
                inputType="password"
                locked={passwordChangeLocked}
                lockMessage={lockMessage}
                onChange={onPasswordChange}
              />
            </tbody>
          </table>
        </div>
        <div className={styles.buttonRow}>
          {canDelete && (
            <>
              <Button variant="destructive" onClick={showDeleteUserModal(true)} ref={deleteUserRef}>
                Delete user
              </Button>
              <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete user"
                body="Are you sure you want to delete this user?"
                confirmText="Delete user"
                onConfirm={handleUserDelete}
                onDismiss={showDeleteUserModal(false)}
              />
            </>
          )}
          {user.isDisabled && canEnable && (
            <Button variant="secondary" onClick={handleUserEnable}>
              Enable user
            </Button>
          )}
          {!user.isDisabled && canDisable && (
            <>
              <Button variant="secondary" onClick={showDisableUserModal(true)} ref={disableUserRef}>
                Disable user
              </Button>
              <ConfirmModal
                isOpen={showDisableModal}
                title="Disable user"
                body="Are you sure you want to disable this user?"
                confirmText="Disable user"
                onConfirm={handleUserDisable}
                onDismiss={showDisableUserModal(false)}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

const styles = {
  buttonRow: css`
    margin-top: 0.8rem;
    > * {
      margin-right: 16px;
    }
  `,
};

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
      css`
        font-weight: 500;
      `
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
            confirmText="Save"
            onClick={this.onEditClick}
            onConfirm={this.onSave}
            onCancel={this.onCancelClick}
          >
            Edit
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

export const LockedRow: FC<LockedRowProps> = ({ label, value, lockMessage }) => {
  const lockMessageClass = css`
    font-style: italic;
    margin-right: 0.6rem;
  `;
  const labelClass = cx(
    'width-16',
    css`
      font-weight: 500;
    `
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
