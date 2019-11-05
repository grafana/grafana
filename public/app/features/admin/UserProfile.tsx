import React, { PureComponent } from 'react';
import appEvents from 'app/core/app_events';
// import { dateTime } from '@grafana/data';
import { EditableRow } from './UserProfileRow';
import { UserDTO, CoreEvents } from 'app/types';

// const defaultTimeFormat = 'dddd YYYY-MM-DD HH:mm:ss';

interface Props {
  user: UserDTO;

  onUserDelete: (userId: number) => void;
  onUserDisable: (userId: number) => void;
}

interface State {
  isLoading: boolean;
}

export class UserProfile extends PureComponent<Props, State> {
  handleUserDelete = () => {
    const { user, onUserDelete } = this.props;
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Delete user',
      text: 'Are you sure you want to delete this user?',
      yesText: 'Delete user',
      icon: 'fa-warning',
      onConfirm: () => {
        onUserDelete(user.id);
      },
    });
  };

  handleUserDisable = () => {
    const { user, onUserDisable } = this.props;
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Disable user',
      text: 'Are you sure you want to disable this user?',
      yesText: 'Disable user',
      icon: 'fa-warning',
      onConfirm: () => {
        onUserDisable(user.id);
      },
    });
  };

  render() {
    const { user } = this.props;
    // const updateTime = dateTime(user.updatedAt).format(defaultTimeFormat);

    return (
      <>
        <h3 className="page-heading">User information</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                <EditableRow label="Name" value={user.name} />
                <EditableRow label="Email" value={user.email} />
                <EditableRow label="Username" value={user.login} />
                <EditableRow label="Password" value="******" />
              </tbody>
            </table>
          </div>
          <div className="gf-form-button-row">
            <button className="btn btn-danger" onClick={this.handleUserDelete}>
              Delete User
            </button>
            <button className="btn btn-danger" onClick={this.handleUserDisable}>
              Disable User
            </button>
          </div>
        </div>
      </>
    );
  }
}
