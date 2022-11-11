import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { renderMarkdown } from '@grafana/data';
import { HorizontalGroup, Pagination, VerticalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { OrgUser, OrgRole, StoreState } from 'app/types';

import InviteesTable from '../invites/InviteesTable';
import { fetchInvitees } from '../invites/state/actions';
import { selectInvitesMatchingQuery } from '../invites/state/selectors';

import UsersActionBar from './UsersActionBar';
import UsersTable from './UsersTable';
import { loadUsers, removeUser, updateUser } from './state/actions';
import { setUsersSearchQuery, setUsersSearchPage } from './state/reducers';
import { getUsers, getUsersSearchQuery, getUsersSearchPage } from './state/selectors';

function mapStateToProps(state: StoreState) {
  const searchQuery = getUsersSearchQuery(state.users);
  return {
    users: getUsers(state.users),
    searchQuery: getUsersSearchQuery(state.users),
    searchPage: getUsersSearchPage(state.users),
    invitees: selectInvitesMatchingQuery(state.invites, searchQuery),
    externalUserMngInfo: state.users.externalUserMngInfo,
    hasFetched: state.users.hasFetched,
  };
}

const mapDispatchToProps = {
  loadUsers,
  fetchInvitees,
  setUsersSearchQuery,
  setUsersSearchPage,
  updateUser,
  removeUser,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = ConnectedProps<typeof connector>;

export interface State {
  showInvites: boolean;
}

const pageLimit = 30;

export class UsersListPage extends PureComponent<Props, State> {
  declare externalUserMngInfoHtml: string;

  constructor(props: Props) {
    super(props);

    if (this.props.externalUserMngInfo) {
      this.externalUserMngInfoHtml = renderMarkdown(this.props.externalUserMngInfo);
    }

    this.state = {
      showInvites: false,
    };
  }

  componentDidMount() {
    this.fetchUsers();
    this.fetchInvitees();
  }

  async fetchUsers() {
    return await this.props.loadUsers();
  }

  async fetchInvitees() {
    return await this.props.fetchInvitees();
  }

  onRoleChange = (role: OrgRole, user: OrgUser) => {
    const updatedUser = { ...user, role: role };

    this.props.updateUser(updatedUser);
  };

  onShowInvites = () => {
    this.setState((prevState) => ({
      showInvites: !prevState.showInvites,
    }));
  };

  getPaginatedUsers = (users: OrgUser[]) => {
    const offset = (this.props.searchPage - 1) * pageLimit;
    return users.slice(offset, offset + pageLimit);
  };

  renderTable() {
    const { invitees, users, setUsersSearchPage } = this.props;
    const paginatedUsers = this.getPaginatedUsers(users);
    const totalPages = Math.ceil(users.length / pageLimit);

    if (this.state.showInvites) {
      return <InviteesTable invitees={invitees} />;
    } else {
      return (
        <VerticalGroup spacing="md">
          <UsersTable
            users={paginatedUsers}
            orgId={contextSrv.user.orgId}
            onRoleChange={(role, user) => this.onRoleChange(role, user)}
            onRemoveUser={(user) => this.props.removeUser(user.userId)}
          />
          <HorizontalGroup justify="flex-end">
            <Pagination
              onNavigate={setUsersSearchPage}
              currentPage={this.props.searchPage}
              numberOfPages={totalPages}
              hideWhenSinglePage={true}
            />
          </HorizontalGroup>
        </VerticalGroup>
      );
    }
  }

  render() {
    const { hasFetched } = this.props;
    const externalUserMngInfoHtml = this.externalUserMngInfoHtml;

    return (
      <Page navId="users">
        <Page.Contents isLoading={!hasFetched}>
          <>
            <UsersActionBar onShowInvites={this.onShowInvites} showInvites={this.state.showInvites} />
            {externalUserMngInfoHtml && (
              <div className="grafana-info-box" dangerouslySetInnerHTML={{ __html: externalUserMngInfoHtml }} />
            )}
            {hasFetched && this.renderTable()}
          </>
        </Page.Contents>
      </Page>
    );
  }
}

export default connector(UsersListPage);
