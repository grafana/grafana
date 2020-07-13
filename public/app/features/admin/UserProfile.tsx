import React, { PureComponent, FC } from 'react';
import { UserDTO } from 'app/types';
import { cx, css } from 'emotion';
import { config } from 'app/core/config';
import { GrafanaTheme } from '@grafana/data';
import { ConfirmButton, ConfirmModal, LegacyInputStatus, Button, stylesFactory, Input } from '@grafana/ui';

interface Props {
  user: UserDTO;

  onUserUpdate: (user: UserDTO) => void;
  onUserDelete: (userId: number) => void;
  onUserDisable: (userId: number) => void;
  onUserEnable: (userId: number) => void;
  onPasswordChange(password: string): void;
}

interface State {
  isLoading: boolean;
  showDeleteModal: boolean;
  showDisableModal: boolean;
}

export class UserProfile extends PureComponent<Props, State> {
  state = {
    isLoading: false,
    showDeleteModal: false,
    showDisableModal: false,
  };

  showDeleteUserModal = (show: boolean) => () => {
    this.setState({ showDeleteModal: show });
  };

  showDisableUserModal = (show: boolean) => () => {
    this.setState({ showDisableModal: show });
  };

  onUserDelete = () => {
    const { user, onUserDelete } = this.props;
    onUserDelete(user.id);
  };

  onUserDisable = () => {
    const { user, onUserDisable } = this.props;
    onUserDisable(user.id);
  };

  onUserEnable = () => {
    const { user, onUserEnable } = this.props;
    onUserEnable(user.id);
  };

  onUserNameChange = (newValue: string) => {
    const { user, onUserUpdate } = this.props;
    onUserUpdate({
      ...user,
      name: newValue,
    });
  };

  onUserEmailChange = (newValue: string) => {
    const { user, onUserUpdate } = this.props;
    onUserUpdate({
      ...user,
      email: newValue,
    });
  };

  onUserLoginChange = (newValue: string) => {
    const { user, onUserUpdate } = this.props;
    onUserUpdate({
      ...user,
      login: newValue,
    });
  };

  onPasswordChange = (newValue: string) => {
    this.props.onPasswordChange(newValue);
  };

  render() {
    const { user } = this.props;
    const { showDeleteModal, showDisableModal } = this.state;
    const authSource = user.authLabels?.length && user.authLabels[0];
    const lockMessage = authSource ? `Synced via ${authSource}` : '';
    const styles = getStyles(config.theme);

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
                  locked={user.isExternal}
                  lockMessage={lockMessage}
                  onChange={this.onUserNameChange}
                />
                <UserProfileRow
                  label="Email"
                  value={user.email}
                  locked={user.isExternal}
                  lockMessage={lockMessage}
                  onChange={this.onUserEmailChange}
                />
                <UserProfileRow
                  label="Username"
                  value={user.login}
                  locked={user.isExternal}
                  lockMessage={lockMessage}
                  onChange={this.onUserLoginChange}
                />
                <UserProfileRow
                  label="Password"
                  value="********"
                  inputType="password"
                  locked={user.isExternal}
                  lockMessage={lockMessage}
                  onChange={this.onPasswordChange}
                />
              </tbody>
            </table>
          </div>
          <div className={styles.buttonRow}>
            <Button variant="destructive" onClick={this.showDeleteUserModal(true)}>
              Delete User
            </Button>
            <ConfirmModal
              isOpen={showDeleteModal}
              title="Delete user"
              body="Are you sure you want to delete this user?"
              confirmText="Delete user"
              onConfirm={this.onUserDelete}
              onDismiss={this.showDeleteUserModal(false)}
            />
            {user.isDisabled ? (
              <Button variant="secondary" onClick={this.onUserEnable}>
                Enable User
              </Button>
            ) : (
              <Button variant="secondary" onClick={this.showDisableUserModal(true)}>
                Disable User
              </Button>
            )}
            <ConfirmModal
              isOpen={showDisableModal}
              title="Disable user"
              body="Are you sure you want to disable this user?"
              confirmText="Disable user"
              onConfirm={this.onUserDisable}
              onDismiss={this.showDisableUserModal(false)}
            />
          </div>
        </div>
      </>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    buttonRow: css`
      margin-top: 0.8rem;
      > * {
        margin-right: 16px;
      }
    `,
  };
});

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
  inputElem: HTMLInputElement;

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

  setInputElem = (elem: any) => {
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

    this.setState({ value: event.target.value });
  };

  onInputBlur = (event: React.FocusEvent<HTMLInputElement>, status?: LegacyInputStatus) => {
    if (status === LegacyInputStatus.Invalid) {
      return;
    }

    this.setState({ value: event.target.value });
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
    const editButtonContainerClass = cx('pull-right');

    if (locked) {
      return <LockedRow label={label} value={value} lockMessage={lockMessage} />;
    }

    return (
      <tr>
        <td className={labelClass}>{label}</td>
        <td className="width-25" colSpan={2}>
          {this.state.editing ? (
            <Input
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
          <div className={editButtonContainerClass}>
            <ConfirmButton
              confirmText="Save"
              onClick={this.onEditClick}
              onConfirm={this.onSave}
              onCancel={this.onCancelClick}
            >
              Edit
            </ConfirmButton>
          </div>
        </td>
      </tr>
    );
  }
}

interface LockedRowProps {
  label: string;
  value?: any;
  lockMessage?: string;
}

export const LockedRow: FC<LockedRowProps> = ({ label, value, lockMessage }) => {
  const lockMessageClass = cx(
    'pull-right',
    css`
      font-style: italic;
      margin-right: 0.6rem;
    `
  );
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
