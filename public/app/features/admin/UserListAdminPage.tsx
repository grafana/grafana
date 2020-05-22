import React, { useEffect } from 'react';
import { css, cx } from 'emotion';
import { hot } from 'react-hot-loader';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { Pagination, Tooltip, HorizontalGroup, stylesFactory, LinkButton, Input, Icon } from '@grafana/ui';
import { StoreState, UserDTO } from '../../types';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from '../../core/selectors/navModel';
import { fetchUsers, changeQuery, changePage } from './state/actions';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

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
  const styles = getStyles();

  useEffect(() => {
    props.fetchUsers();
  }, []);

  return (
    <Page navModel={props.navModel}>
      <Page.Contents>
        <>
          <div>
            <HorizontalGroup justify="space-between">
              <Input
                width={40}
                type="text"
                placeholder="Search user by login,email or name"
                tabIndex={1}
                autoFocus={true}
                value={props.query}
                spellCheck={false}
                onChange={event => props.changeQuery(event.currentTarget.value)}
                prefix={<Icon name="search" />}
              />
              <LinkButton href="admin/users/create" variant="primary">
                New user
              </LinkButton>
            </HorizontalGroup>
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
              <tbody>{props.users.map(renderUser)}</tbody>
            </table>
          </div>
          {props.showPaging && (
            <Pagination numberOfPages={props.totalPages} currentPage={props.page} onNavigate={props.changePage} />
          )}
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
      <td className="link-td">
        <a href={editUrl}>{user.name}</a>
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
