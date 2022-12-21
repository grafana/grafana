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

import { UsersActionBar } from './UsersActionBar';
import UsersTable from './UsersTable';
import { loadUsers, removeUser, updateUser, changePage } from './state/actions';
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
    externalUserMngInfo: state.users.externalUserMngInfo,
    isLoading: state.users.isLoading,
  };
}

const mapDispatchToProps = {
  loadUsers,
  fetchInvitees,
  changePage,
  updateUser,
  removeUser,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = ConnectedProps<typeof connector>;

export interface State {
  showInvites: boolean;
}

export class UsersListPageUnconnected extends PureComponent<Props, State> {
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

  renderTable() {
    const { invitees, users, page, totalPages, changePage } = this.props;

    if (this.state.showInvites) {
      return <InviteesTable invitees={invitees} />;
    } else {
      return (
        <VerticalGroup spacing="md">
          <UsersTable
            users={users}
            orgId={contextSrv.user.orgId}
            onRoleChange={(role, user) => this.onRoleChange(role, user)}
            onRemoveUser={(user) => this.props.removeUser(user.userId)}
          />
          <HorizontalGroup justify="flex-end">
            <Pagination
              onNavigate={changePage}
              currentPage={page}
              numberOfPages={totalPages}
              hideWhenSinglePage={true}
            />
          </HorizontalGroup>
        </VerticalGroup>
      );
    }
  }

  render() {
    const { isLoading } = this.props;
    const externalUserMngInfoHtml = this.externalUserMngInfoHtml;

    return (
      <Page.Contents isLoading={!isLoading}>
        <UsersActionBar onShowInvites={this.onShowInvites} showInvites={this.state.showInvites} />
        {externalUserMngInfoHtml && (
          <div className="grafana-info-box" dangerouslySetInnerHTML={{ __html: externalUserMngInfoHtml }} />
        )}
        {isLoading && this.renderTable()}
      </Page.Contents>
    );
  }
}

export const UsersListPageContent = connector(UsersListPageUnconnected);

export default function UsersListPage() {
  return (
    <Page navId="users">
      <UsersListPageContent />
    </Page>
  );
}
