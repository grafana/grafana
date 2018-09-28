import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import OrgActionBar from 'app/core/components/OrgActionBar/OrgActionBar';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import UsersTable from 'app/features/users/UsersTable';
import { NavModel, User } from 'app/types';
import { loadUsers, setUsersSearchQuery } from './state/actions';
import { getNavModel } from '../../core/selectors/navModel';
import { getUsers, getUsersSearchQuery } from './state/selectors';

export interface Props {
  navModel: NavModel;
  users: User[];
  searchQuery: string;
  loadUsers: typeof loadUsers;
  setUsersSearchQuery: typeof setUsersSearchQuery;
}

export class UsersListPage extends PureComponent<Props> {
  componentDidMount() {
    this.fetchUsers();
  }

  async fetchUsers() {
    return await this.props.loadUsers();
  }
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
          <UsersTable users={users} />
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
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UsersListPage));
