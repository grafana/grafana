import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import Remarkable from 'remarkable';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import UsersActionBar from './UsersActionBar';
import UsersTable from './UsersTable';
import InviteesTable from './InviteesTable';
import { Invitee, NavModel, OrgUser } from 'app/types';
import appEvents from 'app/core/app_events';
import { loadUsers, loadInvitees, revokeInvite, setUsersSearchQuery, updateUser, removeUser } from './state/actions';
import { getNavModel } from '../../core/selectors/navModel';
import { getInvitees, getUsers, getUsersSearchQuery } from './state/selectors';

export interface Props {
  navModel: NavModel;
  invitees: Invitee[];
  users: OrgUser[];
  searchQuery: string;
  externalUserMngInfo: string;
  hasFetched: boolean;
  loadUsers: typeof loadUsers;
  loadInvitees: typeof loadInvitees;
  setUsersSearchQuery: typeof setUsersSearchQuery;
  updateUser: typeof updateUser;
  removeUser: typeof removeUser;
  revokeInvite: typeof revokeInvite;
}

export interface State {
  showInvites: boolean;
}

export class UsersListPage extends PureComponent<Props, State> {
  externalUserMngInfoHtml: string;

  constructor(props) {
    super(props);

    if (this.props.externalUserMngInfo) {
      const markdownRenderer = new Remarkable();
      this.externalUserMngInfoHtml = markdownRenderer.render(this.props.externalUserMngInfo);
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

  onRoleChange = (role, user) => {
    const updatedUser = { ...user, role: role };

    this.props.updateUser(updatedUser);
  };

  onRemoveUser = user => {
    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete user ' + user.login + '?',
      yesText: 'Delete',
      icon: 'fa-warning',
      onConfirm: () => {
        this.props.removeUser(user.userId);
      },
    });
  };

  onRevokeInvite = code => {
    this.props.revokeInvite(code);
  };

  onShowInvites = () => {
    this.setState(prevState => ({
      showInvites: !prevState.showInvites,
    }));
  };

  renderTable() {
    const { invitees, users } = this.props;

    if (this.state.showInvites) {
      return <InviteesTable invitees={invitees} onRevokeInvite={code => this.onRevokeInvite(code)} />;
    } else {
      return (
        <UsersTable
          users={users}
          onRoleChange={(role, user) => this.onRoleChange(role, user)}
          onRemoveUser={user => this.onRemoveUser(user)}
        />
      );
    }
  }

  render() {
    const { navModel, hasFetched } = this.props;
    const externalUserMngInfoHtml = this.externalUserMngInfoHtml;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <UsersActionBar onShowInvites={this.onShowInvites} showInvites={this.state.showInvites} />
          {externalUserMngInfoHtml && (
            <div className="grafana-info-box" dangerouslySetInnerHTML={{ __html: externalUserMngInfoHtml }} />
          )}
          {hasFetched ? this.renderTable() : <PageLoader pageName="Users" />}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    navModel: getNavModel(state.navIndex, 'users'),
    users: getUsers(state.users),
    searchQuery: getUsersSearchQuery(state.users),
    invitees: getInvitees(state.users),
    externalUserMngInfo: state.users.externalUserMngInfo,
    hasFetched: state.users.hasFetched,
  };
}

const mapDispatchToProps = {
  loadUsers,
  loadInvitees,
  setUsersSearchQuery,
  updateUser,
  removeUser,
  revokeInvite,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UsersListPage));
