import React, { useEffect } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { getTagColorsFromName, Pagination, Forms, ActionBar, ActionBarSpacing, Tooltip } from '@grafana/ui';
import { StoreState, UserDTO } from '../../types';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from '../../core/selectors/navModel';
import { fetchUsers, changeQuery, changePage } from './state/actions';

interface OwnProps {}

interface ConnectedProps {
  navModel: NavModel;
  users: UserDTO[];
  query: string;
  showPaging: boolean;
  totalPages: number;
  page: number;
}

interface DispatchProps {
  fetchUsers: typeof fetchUsers;
  changeQuery: typeof changeQuery;
  changePage: typeof changePage;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

const UserListAdminPageUnConnected: React.FC<Props> = props => {
  useEffect(() => {
    props.fetchUsers();
  }, []);

  return (
    <Page navModel={props.navModel}>
      <Page.Contents>
        <>
          <ActionBar>
            <Forms.Input
              size="md"
              type="text"
              placeholder="Find user by name/login/email"
              tabIndex={1}
              autoFocus={true}
              value={props.query}
              spellCheck={false}
              onChange={event => props.changeQuery(event.currentTarget.value)}
              prefix={<i className="fa fa-search" />}
            />
            <ActionBarSpacing />
            <Forms.LinkButton href="admin/users/create" variant="primary">
              New user
            </Forms.LinkButton>
          </ActionBar>

          <div className="admin-list-table">
            <table className="filter-table form-inline filter-table--hover">
              <thead>
                <tr>
                  <th></th>
                  <th>Login</th>
                  <th>Email</th>
                  <th>
                    Seen
                    <Tooltip placement="top" content="Time since user was seen using Grafana">
                      <i className="fa fa-question-circle" />
                    </Tooltip>
                  </th>
                  <th></th>
                  <th style={{ width: '1%' }}></th>
                </tr>
              </thead>
              <tbody>{props.users.map(renderUser)}</tbody>
            </table>
          </div>
          <Pagination
            visible={props.showPaging}
            numberOfPages={props.totalPages}
            currentPage={props.page}
            onNavigate={props.changePage}
          />
        </>
      </Page.Contents>
    </Page>
  );
};

const renderUser = (user: UserDTO) => {
  const editUrl = `admin/users/edit/${user.id}`;

  return (
    <tr key={user.id}>
      <td className="width-4 text-center link-td">
        <a href={editUrl}>
          <img className="filter-table__avatar" src={user.avatarUrl} />
        </a>
      </td>
      <td className="link-td">
        <a href={editUrl}>{user.login}</a>
      </td>
      <td className="link-td">
        <a href={editUrl}>{user.email}</a>
      </td>
      <td className="link-td">{user.lastSeenAtAge && <a href={editUrl}>{user.lastSeenAtAge}</a>}</td>
      <td className="link-td">
        {user.isAdmin && (
          <a href={editUrl}>
            <i className="fa fa-shield" bs-tooltip="'Grafana Admin'" />
          </a>
        )}
      </td>
      <td className="text-right">{renderAuthLabel(user)}</td>
      <td className="text-right">
        {user.isDisabled && <span className="label label-tag label-tag--gray">Disabled</span>}
      </td>
    </tr>
  );
};

const renderAuthLabel = (user: UserDTO) => {
  if (!user || !Array.isArray(user.authLabels) || user.authLabels.length === 0) {
    return null;
  }

  const label = user.authLabels[0];
  const style = getAuthLabelStyle(label);

  return (
    <span style={style} className="label label-tag">
      {label}
    </span>
  );
};

const getAuthLabelStyle = (label: string) => {
  if (label === 'LDAP' || !label) {
    return {};
  }

  const { color, borderColor } = getTagColorsFromName(label);

  return {
    backgroundColor: color,
    borderColor: borderColor,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  fetchUsers,
  changeQuery,
  changePage,
};

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({
  navModel: getNavModel(state.navIndex, 'global-users'),
  users: state.userListAdmin.users,
  query: state.userListAdmin.query,
  showPaging: state.userListAdmin.showPaging,
  totalPages: state.userListAdmin.totalPages,
  page: state.userListAdmin.page,
});

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UserListAdminPageUnConnected));
