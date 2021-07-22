import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel, renderMarkdown } from '@grafana/data';
import { HorizontalGroup, Pagination, VerticalGroup } from '@grafana/ui';

import Page from 'app/core/components/Page/Page';
import UsersActionBar from './UsersActionBar';
import UsersTable from './UsersTable';
import InviteesTable from './InviteesTable';
import { Invitee, OrgUser, OrgRole } from 'app/types';
import { loadInvitees, loadUsers, removeUser, updateUser } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getInvitees, getUsers, getUsersSearchQuery, getUsersSearchPage } from './state/selectors';
import { setUsersSearchQuery, setUsersSearchPage } from './state/reducers';

export interface Props {
  navModel: NavModel;
  invitees: Invitee[];
  users: OrgUser[];
  searchQuery: string;
  searchPage: number;
  externalUserMngInfo: string;
  hasFetched: boolean;
  loadUsers: typeof loadUsers;
  loadInvitees: typeof loadInvitees;
  setUsersSearchQuery: typeof setUsersSearchQuery;
  setUsersSearchPage: typeof setUsersSearchPage;
  updateUser: typeof updateUser;
  removeUser: typeof removeUser;
}

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
    return await this.props.loadInvitees();
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
    const { navModel, hasFetched } = this.props;
    const externalUserMngInfoHtml = this.externalUserMngInfoHtml;

    return (
      <Page navModel={navModel}>
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

function mapStateToProps(state: any) {
  return {
    navModel: getNavModel(state.navIndex, 'users'),
    users: getUsers(state.users),
    searchQuery: getUsersSearchQuery(state.users),
    searchPage: getUsersSearchPage(state.users),
    invitees: getInvitees(state.users),
    externalUserMngInfo: state.users.externalUserMngInfo,
    hasFetched: state.users.hasFetched,
  };
}

const mapDispatchToProps = {
  loadUsers,
  loadInvitees,
  setUsersSearchQuery,
  setUsersSearchPage,
  updateUser,
  removeUser,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UsersListPage));
