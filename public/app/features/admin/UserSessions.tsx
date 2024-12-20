import { createRef, PureComponent } from 'react';

import { ConfirmButton, ConfirmModal, Button, Stack } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { contextSrv } from 'app/core/core';
import { t, Trans } from 'app/core/internationalization';
import { formatDate } from 'app/core/internationalization/dates';
import { AccessControlAction, UserSession } from 'app/types';

interface Props {
  sessions: UserSession[];

  onSessionRevoke: (id: number) => void;
  onAllSessionsRevoke: () => void;
}

interface State {
  showLogoutModal: boolean;
}

class BaseUserSessions extends PureComponent<Props, State> {
  forceAllLogoutButton = createRef<HTMLButtonElement>();
  state: State = {
    showLogoutModal: false,
  };

  showLogoutConfirmationModal = () => {
    this.setState({ showLogoutModal: true });
  };

  dismissLogoutConfirmationModal = () => {
    this.setState({ showLogoutModal: false }, () => {
      this.forceAllLogoutButton.current?.focus();
    });
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

    const canLogout = contextSrv.hasPermission(AccessControlAction.UsersLogout);

    return (
      <div>
        <h3 className="page-heading">
          <Trans i18nKey="admin.user-sessions.title">Sessions</Trans>
        </h3>
        <Stack direction="column" gap={1.5}>
          <div>
            <table className="filter-table form-inline">
              <thead>
                <tr>
                  <th>
                    <Trans i18nKey="admin.user-sessions.last-seen-column">Last seen</Trans>
                  </th>
                  <th>
                    <Trans i18nKey="admin.user-sessions.logged-on-column">Logged on</Trans>
                  </th>
                  <th>
                    <Trans i18nKey="admin.user-sessions.ip-column">IP address</Trans>
                  </th>
                  <th>
                    <Trans i18nKey="admin.user-sessions.browser-column">Browser and OS</Trans>
                  </th>
                  <th colSpan={2}>
                    <Trans i18nKey="user-session.auth-module-column">Identity Provider</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions &&
                  sessions.map((session, index) => (
                    <tr key={`${session.id}-${index}`}>
                      <td>{session.isActive ? 'Now' : session.seenAt}</td>
                      <td>{formatDate(session.createdAt, { dateStyle: 'long' })}</td>
                      <td>{session.clientIp}</td>
                      <td>{`${session.browser} on ${session.os} ${session.osVersion}`}</td>
                      <td>
                        {session.authModule && <TagBadge label={session.authModule} removeIcon={false} count={0} />}
                      </td>
                      <td>
                        {canLogout && (
                          <ConfirmButton
                            confirmText="Confirm logout"
                            confirmVariant="destructive"
                            onConfirm={this.onSessionRevoke(session.id)}
                          >
                            {t('admin.user-sessions.force-logout-button', 'Force logout')}
                          </ConfirmButton>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div>
            {canLogout && sessions.length > 0 && (
              <Button variant="secondary" onClick={this.showLogoutConfirmationModal} ref={this.forceAllLogoutButton}>
                <Trans i18nKey="admin.user-sessions.force-logout-all-button">Force logout from all devices</Trans>
              </Button>
            )}
            <ConfirmModal
              isOpen={showLogoutModal}
              title="Force logout from all devices"
              body="Are you sure you want to force logout from all devices?"
              confirmText="Force logout"
              onConfirm={this.onAllSessionsRevoke}
              onDismiss={this.dismissLogoutConfirmationModal}
            />
          </div>
        </Stack>
      </div>
    );
  }
}

export const UserSessions = BaseUserSessions;
