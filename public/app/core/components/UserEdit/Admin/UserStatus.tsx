import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { OrgUser, StoreState } from 'app/types';
import { toggleUserStatus } from '../state/actions';
import { Button } from '@grafana/ui';

export interface Props {
  userId: number;
  user: OrgUser;
  toggleUserStatus: typeof toggleUserStatus;
}

export class UserStatus extends PureComponent<Props> {
  async onDisableUser() {
    const { user, userId } = this.props;

    // External user can not be disabled
    if (user.authModule) {
      return;
    }

    await this.props.toggleUserStatus(user.isDisabled, userId);
  }

  onDeleteUser() {
    const { user, userId } = this.props;
    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: 'Do you want to delete ' + user.login + '?',
      yesText: 'Delete',
      icon: 'fa-trash',
      onConfirm: () => {
        getBackendSrv()
          .delete('/api/admin/users/' + userId)
          .then(() => {
            window.location.href = '/admin/users';
          });
      },
    });
  }

  render() {
    const { user } = this.props;
    return (
      <div className="gf-form-group">
        <h3 className="page-sub-heading">User status</h3>
        <div className="gf-form-button-row">
          {!user.isDisabled && (
            <Button
              variant="danger"
              onClick={event => {
                event.preventDefault();
                this.onDisableUser();
              }}
              disabled={!!user.authModule}
            >
              Disable
            </Button>
          )}
          {user.isDisabled && (
            <Button
              onClick={event => {
                event.preventDefault();
                this.onDisableUser();
              }}
              disabled={!!user.authModule}
            >
              Enable
            </Button>
          )}
          {user.authModule && <p>External user cannot be activated or deactivated</p>}
          <Button
            variant="danger"
            onClick={event => {
              event.preventDefault();
              this.onDeleteUser();
            }}
          >
            Delete User
          </Button>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    user: state.user.profile,
  };
}

const mapDispatchToProps = {
  toggleUserStatus,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserStatus)
);
