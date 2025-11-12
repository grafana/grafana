import { css, cx } from '@emotion/css';
import { memo, useRef, useState, useCallback, useEffect } from 'react';
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

export const UserProfileRow = memo(
  ({
    label,
    value: valueProp = '',
    locked = false,
    lockMessage = '',
    inputType = 'text',
    onChange,
  }: UserProfileRowProps) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(valueProp);
    const inputElemRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setValue(valueProp);
    }, [valueProp]);

    const focusInput = useCallback(() => {
      if (inputElemRef.current) {
        inputElemRef.current.focus();
      }
    }, []);

    const onEditClick = useCallback(() => {
      if (inputType === 'password') {
        // Reset value for password field
        setValue('');
        setEditing(true);
        setTimeout(focusInput, 0);
      } else {
        setEditing(true);
        setTimeout(focusInput, 0);
      }
    }, [inputType, focusInput]);

    const onCancelClick = useCallback(() => {
      setEditing(false);
      setValue(valueProp);
    }, [valueProp]);

    const onInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>, status?: LegacyInputStatus) => {
      if (status === LegacyInputStatus.Invalid) {
        return;
      }

      setValue(event.target.value);
    }, []);

    const onInputBlur = useCallback((event: React.FocusEvent<HTMLInputElement>, status?: LegacyInputStatus) => {
      if (status === LegacyInputStatus.Invalid) {
        return;
      }

      setValue(event.target.value);
    }, []);

    const onSave = useCallback(() => {
      if (onChange) {
        onChange(value);
      }
    }, [onChange, value]);

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
          {editing ? (
            <Input
              id={inputId}
              type={inputType}
              defaultValue={value}
              onBlur={onInputBlur}
              onChange={onInputChange}
              ref={inputElemRef}
              width={30}
            />
          ) : (
            <span>{valueProp}</span>
          )}
        </td>
        <td>
          <ConfirmButton
            confirmText={t('admin.user-profile-row.confirmText-save', 'Save')}
            onClick={onEditClick}
            onConfirm={onSave}
            onCancel={onCancelClick}
          >
            {t('admin.user-profile.edit-button', 'Edit')}
          </ConfirmButton>
        </td>
      </tr>
    );
  }
);

UserProfileRow.displayName = 'UserProfileRow';

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
