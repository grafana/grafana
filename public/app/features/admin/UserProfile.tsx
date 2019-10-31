import React, { PureComponent } from 'react';
// import { dateTime } from '@grafana/data';
import { EditableRow } from './UserProfileRow';
import { UserDTO } from 'app/types';

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
    onUserDelete(user.id);
  };

  handleUserDisable = () => {
    const { user, onUserDisable } = this.props;
    onUserDisable(user.id);
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
