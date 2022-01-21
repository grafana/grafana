import React, { PureComponent } from 'react';
import { UserSession } from 'app/types';
import { Button, Icon, LoadingPlaceholder } from '@grafana/ui';
import { withI18n, withI18nProps } from '@lingui/react';
import { t, Trans } from '@lingui/macro';
import { selectors } from '@grafana/e2e-selectors';

interface Props extends withI18nProps {
  sessions: UserSession[];
  isLoading: boolean;
  revokeUserSession: (tokenId: number) => void;
}

class UserSessions extends PureComponent<Props> {
  render() {
    const { isLoading, sessions, revokeUserSession, i18n } = this.props;

    if (isLoading) {
      return <LoadingPlaceholder text={<Trans id="user-sessions.loading">Loading sessions...</Trans>} />;
    }

    return (
      <div>
        {sessions.length > 0 && (
          <>
            <h3 className="page-sub-heading">Sessions</h3>
            <div className="gf-form-group">
              <table className="filter-table form-inline" data-testid={selectors.components.UserProfile.sessionsTable}>
                <thead>
                  <tr>
                    <th>
                      <Trans id="user-session.seen-at-column">Last seen</Trans>
                    </th>
                    <th>
                      <Trans id="user-session.created-at-column">Logged on</Trans>
                    </th>
                    <th>
                      <Trans id="user-session.ip-column">IP address</Trans>
                    </th>
                    <th>
                      <Trans id="user-session.browser-column">Browser &amp; OS</Trans>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session: UserSession, index) => (
                    <tr key={index}>
                      {session.isActive ? <td>Now</td> : <td>{session.seenAt}</td>}
                      <td>{i18n.date(session.createdAt, { dateStyle: 'long' })}</td>
                      <td>{session.clientIp}</td>
                      <td>
                        {session.browser} on {session.os} {session.osVersion}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revokeUserSession(session.id)}
                          aria-label={t({ id: 'user-session.revoke', message: 'Revoke user session' })}
                        >
                          <Icon name="power" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }
}

export default withI18n()(UserSessions);
