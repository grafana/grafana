import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import OrgActionBar from 'app/core/components/OrgActionBar/OrgActionBar';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import UsersTable from 'app/features/users/UsersTable';
import { NavModel, User } from 'app/types';
import appEvents from 'app/core/app_events';
import { loadUsers, setUsersSearchQuery, updateUser, removeUser } from './state/actions';
import { getNavModel } from '../../core/selectors/navModel';
import { getUsers, getUsersSearchQuery } from './state/selectors';

export interface Props {
  navModel: NavModel;
  users: User[];
  searchQuery: string;
  loadUsers: typeof loadUsers;
  setUsersSearchQuery: typeof setUsersSearchQuery;
  updateUser: typeof updateUser;
  removeUser: typeof removeUser;
}

export class UsersListPage extends PureComponent<Props> {
  componentDidMount() {
    this.fetchUsers();
  }

  async fetchUsers() {
    return await this.props.loadUsers();
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

  render() {
    const { navModel, searchQuery, setUsersSearchQuery, users } = this.props;

    const linkButton = {
      href: '/org/users/add',
      title: 'Add user',
    };

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <OrgActionBar
            searchQuery={searchQuery}
            showLayoutMode={false}
            setSearchQuery={setUsersSearchQuery}
            linkButton={linkButton}
          />
          <UsersTable
            users={users}
            onRoleChange={(role, user) => this.onRoleChange(role, user)}
            onRemoveUser={user => this.onRemoveUser(user)}
          />
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
  };
}

const mapDispatchToProps = {
  loadUsers,
  setUsersSearchQuery,
  updateUser,
  removeUser,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UsersListPage));
