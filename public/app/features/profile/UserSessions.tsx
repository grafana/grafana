import { css } from '@emotion/css';
import { t } from 'i18next';
import React, { PureComponent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Icon, LoadingPlaceholder } from '@grafana/ui';
import { i18nDate, Trans } from 'app/core/internationalization';
import { UserSession } from 'app/types';

interface Props {
  sessions: UserSession[];
  isLoading: boolean;
  revokeUserSession: (tokenId: number) => void;
}

class UserSessions extends PureComponent<Props> {
  render() {
    const { isLoading, sessions, revokeUserSession } = this.props;

    if (isLoading) {
      return <LoadingPlaceholder text={<Trans i18nKey="user-sessions.loading">Loading sessions...</Trans>} />;
    }

    return (
      <div>
        {sessions.length > 0 && (
          <>
            <h3 className="page-sub-heading">Sessions</h3>
            <div className="gf-form-group">
              <table className="filter-table form-inline" data-testid={selectors.components.UserProfile.sessionsTable}>
                <div className={styles.table}>
                  <thead>
                    <tr className={styles.block}>
                      <th>
                        <Trans i18nKey="user-session.seen-at-column">Last seen</Trans>
                      </th>
                      <th>
                        <Trans i18nKey="user-session.created-at-column">Logged on</Trans>
                      </th>
                      <th>
                        <Trans i18nKey="user-session.ip-column">IP address</Trans>
                      </th>
                      <th>
                        <Trans i18nKey="user-session.browser-column">Browser & OS</Trans>
                      </th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {sessions.map((session: UserSession, index) => (
                      <tr className={styles.block} key={index}>
                        {session.isActive ? <td>Now</td> : <td>{session.seenAt}</td>}
                        <td>{i18nDate(session.createdAt, { dateStyle: 'long' })}</td>
                        <td>{session.clientIp}</td>
                        <td>
                          {session.browser} on {session.os} {session.osVersion}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => revokeUserSession(session.id)}
                            aria-label={t('user-session.revoke', 'Revoke user session')}
                          >
                            <Icon name="power" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </div>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }
}

const styles = {
  table: css`
    display: flex;
    flex-wrap: wrap;
  `,
  block: css`
    min-width: 30vw;
    display: flex;
    flex-direction: column;
  `,
};

export default UserSessions;
