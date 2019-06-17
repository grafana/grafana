import React, { PureComponent } from 'react';
import { UserSession } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { Button, dateTime } from '@grafana/ui';
import { ButtonVariant, ButtonSize } from '@grafana/ui/src/components/Button/AbstractButton';

export interface Props {
  adminMode: boolean;
  uid: number;
}

export interface State {
  sessions: UserSession[];
}

export class UserSessions extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      sessions: [] as UserSession[],
    };
  }

  async componentDidMount() {
    await this.loadUserSessions();
  }

  sortSessions(sessions) {
    sessions.reverse();

    const found = sessions.findIndex((session: UserSession) => {
      return session.isActive;
    });

    if (found !== -1) {
      const now = sessions[found];
      sessions.splice(found, found);
      sessions.unshift(now);
    }

    return sessions;
  }

  async revokeAllUserTokens() {
    const { uid } = this.props;
    await getBackendSrv().post('/api/admin/users/' + uid + '/logout', {});
    this.setState({ sessions: [] });
  }

  async revokeUserToken(tokenId: number) {
    const { uid } = this.props;
    let sessions;

    if (uid) {
      await getBackendSrv().post('/api/admin/users/' + uid + '/revoke-auth-token', {
        authTokenId: tokenId,
      });
    } else {
      await getBackendSrv().post('/api/user/revoke-auth-token', {
        authTokenId: tokenId,
      });
    }

    sessions = this.state.sessions.filter((session: UserSession) => {
      if (session.id === tokenId) {
        return false;
      }
      return true;
    });

    this.setState({ sessions });
  }

  async loadUserSessions() {
    const { uid } = this.props;
    let sessions = [];

    if (uid) {
      sessions = await getBackendSrv().get('/api/admin/users/' + uid + '/auth-tokens');
    } else {
      sessions = await getBackendSrv().get('/api/user/auth-tokens');
    }

    sessions = this.sortSessions(sessions);

    sessions = sessions.map((session: UserSession) => {
      return {
        ...session,
        seenAt: dateTime(session.seenAt).fromNow(),
        createdAt: dateTime(session.createdAt).format('MMMM DD, YYYY'),
      };
    });

    this.setState({ sessions });
  }

  render() {
    const { adminMode } = this.props;
    const { sessions } = this.state;
    return (
      <>
        <h3 className="page-sub-heading">Sessions</h3>
        <div className="gf-form-group">
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th>Last seen</th>
                <th>Logged on</th>
                <th>IP address</th>
                <th>Browser &amp; OS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, index) => {
                return (
                  <tr key={index}>
                    <td>{session.isActive ? 'Now' : session.seenAt}</td>
                    <td>{session.createdAt}</td>
                    <td>{session.clientIp}</td>
                    <td>
                      {session.browser} on {session.os} {session.osVersion}
                    </td>
                    <td>
                      <Button
                        variant={ButtonVariant.Danger}
                        size={ButtonSize.Small}
                        onClick={() => {
                          this.revokeUserToken(session.id);
                        }}
                      >
                        <i className="fa fa-power-off" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {adminMode && (
            <Button
              variant={ButtonVariant.Danger}
              onClick={() => {
                this.revokeAllUserTokens();
              }}
            >
              Logout user from all devices
            </Button>
          )}
        </div>
      </>
    );
  }
}

export default UserSessions;
