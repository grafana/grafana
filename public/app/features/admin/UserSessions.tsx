import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { ConfirmButton, ConfirmModal, Button } from '@grafana/ui';
import { UserSession } from 'app/types';

interface Props {
  sessions: UserSession[];

  onSessionRevoke: (id: number) => void;
  onAllSessionsRevoke: () => void;
}

interface State {
  showLogoutModal: boolean;
}

export class UserSessions extends PureComponent<Props, State> {
  state: State = {
    showLogoutModal: false,
  };

  showLogoutConfirmationModal = (show: boolean) => () => {
    this.setState({ showLogoutModal: show });
  };

  onSessionRevoke = (id: number) => {
    return () => {
      this.props.onSessionRevoke(id);
    };
  };

  onAllSessionsRevoke = () => {
    this.setState({ showLogoutModal: false });
    this.props.onAllSessionsRevoke();
  };

  render() {
    const { sessions } = this.props;
    const { showLogoutModal } = this.state;

    const logoutFromAllDevicesClass = css`
      margin-top: 0.8rem;
    `;

    return (
      <>
        <h3 className="page-heading">Sessions</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <thead>
                <tr>
                  <th>Last seen</th>
                  <th>Logged on</th>
                  <th>IP address</th>
                  <th colSpan={2}>Browser &amp; OS</th>
                </tr>
              </thead>
              <tbody>
                {sessions &&
                  sessions.map((session, index) => (
                    <tr key={`${session.id}-${index}`}>
                      <td>{session.isActive ? 'Now' : session.seenAt}</td>
                      <td>{session.createdAt}</td>
                      <td>{session.clientIp}</td>
                      <td>{`${session.browser} on ${session.os} ${session.osVersion}`}</td>
                      <td>
                        <div className="pull-right">
                          <ConfirmButton
                            confirmText="Confirm logout"
                            confirmVariant="destructive"
                            onConfirm={this.onSessionRevoke(session.id)}
                          >
                            Force logout
                          </ConfirmButton>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className={logoutFromAllDevicesClass}>
            {sessions.length > 0 && (
              <Button variant="secondary" onClick={this.showLogoutConfirmationModal(true)}>
                Force logout from all devices
              </Button>
            )}
            <ConfirmModal
              isOpen={showLogoutModal}
              title="Force logout from all devices"
              body="Are you sure you want to force logout from all devices?"
              confirmText="Force logout"
              onConfirm={this.onAllSessionsRevoke}
              onDismiss={this.showLogoutConfirmationModal(false)}
            />
          </div>
        </div>
      </>
    );
  }
}
