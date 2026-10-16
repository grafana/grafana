import { useEffect, useState } from 'react';
import { connect, type ConnectedProps } from 'react-redux';
import { useMeasure } from 'react-use';

import { type OrgRole, renderMarkdown } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, EmptyState, LoadingBar } from '@grafana/ui';
import { useDelayedSwitch } from '@grafana/ui/internal';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { useUserListTabExtensions } from 'app/features/admin/useUserListTabExtensions';
import { type StoreState } from 'app/types/store';
import { type OrgUser } from 'app/types/user';

import { OrgUsersTable } from '../admin/Users/OrgUsersTable';
import InviteesTable from '../invites/InviteesTable';
import { fetchInvitees } from '../invites/state/actions';
import { selectInvitesMatchingQuery } from '../invites/state/selectors';

import { UsersActionBar } from './UsersActionBar';
import { loadUsers, removeUser, updateUser, changePage, changeSort } from './state/actions';
import { getUsers, getUsersSearchQuery } from './state/selectors';

function mapStateToProps(state: StoreState) {
  const searchQuery = getUsersSearchQuery(state.users);
  return {
    users: getUsers(state.users),
    searchQuery: getUsersSearchQuery(state.users),
    page: state.users.page,
    totalPages: state.users.totalPages,
    perPage: state.users.perPage,
    invitees: selectInvitesMatchingQuery(state.invites, searchQuery),
    isLoading: state.users.isLoading,
    rolesLoading: state.users.rolesLoading,
    sort: state.users.sort,
  };
}

const mapDispatchToProps = {
  loadUsers,
  fetchInvitees,
  changePage,
  changeSort,
  updateUser,
  removeUser,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = ConnectedProps<typeof connector>;

const UsersListPageUnconnected = ({
  users,
  page,
  totalPages,
  invitees,
  isLoading,
  rolesLoading,
  loadUsers,
  fetchInvitees,
  changePage,
  updateUser,
  removeUser,
  changeSort,
  sort,
}: Props) => {
  const [showInvites, setShowInvites] = useState(false);
  const [loadingBarRef, { width }] = useMeasure<HTMLDivElement>();
  const showLoading = useDelayedSwitch(isLoading, { delay: 250, duration: 750 });
  const showEmptyState = !showInvites && !isLoading && !showLoading && users?.length === 0;
  const hasUserListExtension = useUserListTabExtensions().length > 0;
  const externalUserMngInfoHtml =
    config.externalUserMngInfo && !hasUserListExtension ? renderMarkdown(config.externalUserMngInfo) : '';

  useEffect(() => {
    loadUsers();
    fetchInvitees();
  }, [fetchInvitees, loadUsers]);

  const onRoleChange = (role: OrgRole, user: OrgUser) => {
    updateUser({ ...user, role: role });
  };

  const onRemoveUser = (user: OrgUser) => removeUser(user.userId);

  const onShowInvites = () => {
    setShowInvites(!showInvites);
  };

  const onUserRolesChange = () => {
    loadUsers();
  };

  const renderTable = () => {
    if (showInvites) {
      return <InviteesTable invitees={invitees} />;
    } else {
      return (
        <OrgUsersTable
          users={users ?? []}
          orgId={contextSrv.user.orgId}
          rolesLoading={rolesLoading}
          onRoleChange={onRoleChange}
          onRemoveUser={onRemoveUser}
          onUserRolesChange={onUserRolesChange}
          fetchData={changeSort}
          sort={sort}
          changePage={changePage}
          page={page}
          totalPages={totalPages}
        />
      );
    }
  };

  return (
    <Page.Contents>
      <UsersActionBar onShowInvites={onShowInvites} showInvites={showInvites} />
      {externalUserMngInfoHtml && (
        <Alert severity="info" title="">
          <div dangerouslySetInnerHTML={{ __html: externalUserMngInfoHtml }} />
        </Alert>
      )}
      <div ref={loadingBarRef} style={{ height: 1 }}>
        {showLoading && (
          <LoadingBar
            width={width}
            delay={0}
            ariaLabel={t('users.users-list-page.loading-users', 'Loading users...')}
          />
        )}
      </div>
      {showEmptyState && <EmptyState message={t('users.empty-state.message', 'No users found')} variant="not-found" />}
      {/* Keep the table mounted so loading and empty states do not trigger its initial sort request again. */}
      <div hidden={!showInvites && showEmptyState}>{renderTable()}</div>
    </Page.Contents>
  );
};

export const UsersListPageContent = connector(UsersListPageUnconnected);
