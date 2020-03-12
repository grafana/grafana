import React, { useEffect } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { StoreState, UserDTO } from '../../types';
import { getNavModel } from '../../core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { getTagColorsFromName } from '@grafana/ui';
import { fetchUsers, changeQuery } from './state/actions';

interface OwnProps {}

interface ConnectedProps {
  navModel: NavModel;
  users: UserDTO[];
  query: string;
}

interface DispatchProps {
  fetchUsers: typeof fetchUsers;
  changeQuery: typeof changeQuery;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

const UserListAdminPageUnConnected: React.FC<Props> = ({ navModel, users, query, fetchUsers, changeQuery }) => {
  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <>
          <div className="page-action-bar">
            <label className="gf-form gf-form--grow gf-form--has-input-icon">
              <input
                type="text"
                className="gf-form-input max-width-30"
                placeholder="Find user by name/login/email"
                tabIndex={1}
                autoFocus={true}
                value={query}
                ng-model-options="{ debounce: 500 }"
                spellCheck={false}
                onChange={event => changeQuery(event.target.value)}
              />
              <i className="gf-form-input-icon fa fa-search"></i>
            </label>
            <div className="page-action-bar__spacer"></div>
            <a className="btn btn-primary" href="admin/users/create">
              New user
            </a>
          </div>

          <div className="admin-list-table">
            <table className="filter-table form-inline filter-table--hover">
              <thead>
                <tr>
                  <th></th>
                  <th>Login</th>
                  <th>Email</th>
                  <th>
                    Seen
                    {/* <tip>Time since user was seen using Grafana</tip> */}
                  </th>
                  <th></th>
                  <th style={{ width: '1%' }}></th>
                </tr>
              </thead>
              <tbody>{users.map(renderUser)}</tbody>
            </table>
          </div>

          <div className="admin-list-paging" ng-if="ctrl.showPaging">
            <ol>
              <li ng-repeat="page in ctrl.pages">
                <button
                  className="btn btn-small"
                  ng-className="{'btn-secondary': page.current, 'btn-inverse': !page.current}"
                  ng-click="ctrl.navigateToPage(page)"
                >
                  {/* {{page.page}} */}
                </button>
              </li>
            </ol>
          </div>
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
      <td className="link-td">{/* <a href={editUrl}>{user.lastSeenAtAge}</a> */}</td>
      <td className="link-td">{renderAdminIcon(user, editUrl)}</td>
      <td className="text-right">{renderAuthLabel(user)}</td>
      <td className="text-right">{renderDisabled(user)}</td>
    </tr>
  );
};

const renderAdminIcon = (user: UserDTO, editUrl: string) => {
  if (!user || !user.isGrafanaAdmin) {
    return null;
  }
  return (
    <a href={editUrl}>
      <i className="fa fa-shield" bs-tooltip="'Grafana Admin'" />
    </a>
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

const renderDisabled = (user: UserDTO) => {
  if (!user || !user.isDisabled) {
    return null;
  }
  return <span className="label label-tag label-tag--gray">Disabled</span>;
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  fetchUsers,
  changeQuery,
};

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({
  navModel: getNavModel(state.navIndex, 'global-users'),
  users: state.userListAdmin.users,
  query: state.userListAdmin.query,
});

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UserListAdminPageUnConnected));
