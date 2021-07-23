import React, { useEffect } from 'react';
import { css, cx } from '@emotion/css';
import { hot } from 'react-hot-loader';
import { connect, ConnectedProps } from 'react-redux';
import { Pagination, Tooltip, stylesFactory, LinkButton, Icon } from '@grafana/ui';
import { AccessControlAction, StoreState, UserDTO } from '../../types';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from '../../core/selectors/navModel';
import { fetchUsers, changeQuery, changePage } from './state/actions';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { contextSrv } from 'app/core/core';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';

const mapDispatchToProps = {
  fetchUsers,
  changeQuery,
  changePage,
};

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'global-users'),
  users: state.userListAdmin.users,
  query: state.userListAdmin.query,
  showPaging: state.userListAdmin.showPaging,
  totalPages: state.userListAdmin.totalPages,
  page: state.userListAdmin.page,
});

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

const UserListAdminPageUnConnected: React.FC<Props> = (props) => {
  const styles = getStyles();
  const { fetchUsers, navModel, query, changeQuery, users, showPaging, totalPages, page, changePage } = props;

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <>
          <div className="page-action-bar">
            <div className="gf-form gf-form--grow">
              <FilterInput
                placeholder="Search user by login, email, or name."
                autoFocus={true}
                value={query}
                onChange={(value) => changeQuery(value)}
              />
            </div>
            {contextSrv.hasPermission(AccessControlAction.UsersCreate) && (
              <LinkButton href="admin/users/create" variant="primary">
                New user
              </LinkButton>
            )}
          </div>
          <div className={cx(styles.table, 'admin-list-table')}>
            <table className="filter-table form-inline filter-table--hover">
              <thead>
                <tr>
                  <th></th>
                  <th>Login</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>
                    Seen&nbsp;
                    <Tooltip placement="top" content="Time since user was seen using Grafana">
                      <Icon name="question-circle" />
                    </Tooltip>
                  </th>
                  <th></th>
                  <th style={{ width: '1%' }}></th>
                </tr>
              </thead>
              <tbody>{users.map(renderUser)}</tbody>
            </table>
          </div>
          {showPaging && <Pagination numberOfPages={totalPages} currentPage={page} onNavigate={changePage} />}
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
      <td className="link-td max-width-10">
        <a className="ellipsis" href={editUrl} title={user.login}>
          {user.login}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" href={editUrl} title={user.email}>
          {user.email}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" href={editUrl} title={user.name}>
          {user.name}
        </a>
      </td>
      <td className="link-td">{user.lastSeenAtAge && <a href={editUrl}>{user.lastSeenAtAge}</a>}</td>
      <td className="link-td">
        {user.isAdmin && (
          <a href={editUrl}>
            <Tooltip placement="top" content="Grafana Admin">
              <Icon name="shield" />
            </Tooltip>
          </a>
        )}
      </td>
      <td className="text-right">
        {Array.isArray(user.authLabels) && user.authLabels.length > 0 && (
          <TagBadge label={user.authLabels[0]} removeIcon={false} count={0} />
        )}
      </td>
      <td className="text-right">
        {user.isDisabled && <span className="label label-tag label-tag--gray">Disabled</span>}
      </td>
    </tr>
  );
};

const getStyles = stylesFactory(() => {
  return {
    table: css`
      margin-top: 28px;
    `,
  };
});

export default hot(module)(connector(UserListAdminPageUnConnected));
