import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Icon, Stack, Tag, Tooltip } from '@grafana/ui/src';
import { Page } from 'app/core/components/Page/Page';
import { Trans, t } from 'app/core/internationalization';

import { useGetActiveUsersQuery } from '../../dashboard/api/publicDashboardApi';

import { DashboardsListModalButton } from './DashboardsListModalButton';
import { DeleteUserModalButton } from './DeleteUserModalButton';

const selectors = e2eSelectors.pages.UserListPage.publicDashboards;

export const UserListPublicDashboardPage = () => {
  const { data: users, isLoading } = useGetActiveUsersQuery();

  return (
    <Page.Contents isLoading={isLoading}>
      <table className="filter-table form-inline" data-testid={selectors.container}>
        <thead>
          <tr>
            <th>
              <Trans i18nKey="public-dashboard-users-access-list.table-header.email-label">Email</Trans>
            </th>
            <th>
              <span>
                <Trans i18nKey="public-dashboard-users-access-list.table-header.activated-label">Activated</Trans>
              </span>
              <Tooltip
                placement="top"
                content={t(
                  'public-dashboard-users-access-list.table-header.activated-tooltip',
                  'Earliest time user has been an active user to a dashboard'
                )}
              >
                <Icon name="info-circle" />
              </Tooltip>
            </th>
            <th>
              <Trans i18nKey="public-dashboard-users-access-list.table-header.last-active-label">Last active</Trans>
            </th>
            <th>
              <Trans i18nKey="public-dashboard-users-access-list.table-header.origin-label">Origin</Trans>
            </th>
            <th>
              <Trans i18nKey="public-dashboard-users-access-list.table-header.role-label">Role</Trans>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users?.map((user) => (
            <tr key={user.email}>
              <td className="max-width-10">
                <span className="ellipsis" title={user.email}>
                  {user.email}
                </span>
              </td>
              <td className="max-width-10">{user.firstSeenAtAge}</td>
              <td className="max-width-10">{user.lastSeenAtAge}</td>
              <td className="max-width-10">
                <Stack gap={2}>
                  <span>
                    <Trans
                      i18nKey="public-dashboard-users-access-list.table-body.dashboard-count"
                      count={user.totalDashboards}
                    >
                      {{ count: user.totalDashboards }} dashboards
                    </Trans>
                  </span>
                  <DashboardsListModalButton email={user.email} />
                </Stack>
              </td>
              <td className="max-width-10">
                <Tag name="Viewer" colorIndex={19} />
              </td>
              <td className="text-right">
                <DeleteUserModalButton user={user} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page.Contents>
  );
};
