import { css } from '@emotion/css';
import { PureComponent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Icon, LoadingPlaceholder, ScrollContainer } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { t, Trans } from 'app/core/internationalization';
import { formatDate } from 'app/core/internationalization/dates';
import { UserSession } from 'app/types';

interface Props {
  sessions: UserSession[];
  isLoading: boolean;
  revokeUserSession: (tokenId: number) => void;
}

class UserSessions extends PureComponent<Props> {
  render() {
    const { isLoading, sessions, revokeUserSession } = this.props;
    const styles = getStyles();

    if (isLoading) {
      return <LoadingPlaceholder text={<Trans i18nKey="user-sessions.loading">Loading sessions...</Trans>} />;
    }

    return (
      <div className={styles.wrapper}>
        {sessions.length > 0 && (
          <>
            <h3 className="page-sub-heading">Sessions</h3>
            <ScrollContainer overflowY="visible" overflowX="auto" width="100%">
              <table className="filter-table form-inline" data-testid={selectors.components.UserProfile.sessionsTable}>
                <thead>
                  <tr>
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
                    <th>
                      <Trans i18nKey="user-session.identity-provider-column">Identity Provider</Trans>
                    </th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {sessions.map((session: UserSession, index) => (
                    <tr key={index}>
                      {session.isActive ? <td>Now</td> : <td>{session.seenAt}</td>}
                      <td>{formatDate(session.createdAt, { dateStyle: 'long' })}</td>
                      <td>{session.clientIp}</td>
                      <td>
                        {session.browser} on {session.os} {session.osVersion}
                      </td>
                      <td>
                        {session.authModule && <TagBadge label={session.authModule} removeIcon={false} count={0} />}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="destructive"
                          tooltip={t('user-session.revoke', 'Revoke user session')}
                          onClick={() => revokeUserSession(session.id)}
                          aria-label={t('user-session.revoke', 'Revoke user session')}
                        >
                          <Icon name="power" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollContainer>
          </>
        )}
      </div>
    );
  }
}

const getStyles = () => ({
  wrapper: css({
    maxWidth: '100%',
  }),
});

export default UserSessions;
