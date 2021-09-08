import React, { useEffect, useMemo, memo } from 'react';
import { css, cx } from '@emotion/css';
import { connect, ConnectedProps } from 'react-redux';
import { Icon, IconName, LinkButton, Pagination, RadioButtonGroup, Tooltip, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { contextSrv } from 'app/core/core';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { getNavModel } from '../../core/selectors/navModel';
import { AccessControlAction, StoreState, Unit, UserDTO } from '../../types';
import { changeFilter, changePage, changeQuery, fetchUsers } from './state/actions';
import PageLoader from '../../core/components/PageLoader/PageLoader';

const mapDispatchToProps = {
  fetchUsers,
  changeQuery,
  changePage,
  changeFilter,
};

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'global-users'),
  users: state.userListAdmin.users,
  query: state.userListAdmin.query,
  showPaging: state.userListAdmin.showPaging,
  totalPages: state.userListAdmin.totalPages,
  page: state.userListAdmin.page,
  filter: state.userListAdmin.filter,
  isLoading: state.userListAdmin.isLoading,
});

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

const UserListAdminPageUnConnected: React.FC<Props> = ({
  fetchUsers,
  navModel,
  query,
  changeQuery,
  users,
  showPaging,
  totalPages,
  page,
  changePage,
  changeFilter,
  filter,
  isLoading,
}) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showLicensedRole = useMemo(() => users.some((user) => user.licensedRole), [users]);
  const showUnits = useMemo(() => users.some((user) => user.teams || user.orgs), [users]);
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <RadioButtonGroup
              options={[
                { label: 'All users', value: 'all' },
                { label: 'Active last 30 days', value: 'activeLast30Days' },
              ]}
              onChange={changeFilter}
              value={filter}
              className={styles.filter}
            />
            <FilterInput
              placeholder="Search user by login, email, or name."
              autoFocus={true}
              value={query}
              onChange={changeQuery}
            />
          </div>
          {contextSrv.hasPermission(AccessControlAction.UsersCreate) && (
            <LinkButton href="admin/users/create" variant="primary">
              New user
            </LinkButton>
          )}
        </div>
        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            <div className={cx(styles.table, 'admin-list-table')}>
              <table className="filter-table form-inline filter-table--hover">
                <thead>
                  <tr>
                    <th></th>
                    <th>Login</th>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Server admin</th>
                    {showUnits && <th>Belongs to</th>}
                    {showLicensedRole && <th>Licensed role</th>}
                    <th>
                      Last active&nbsp;
                      <Tooltip placement="top" content="Time since user was seen using Grafana">
                        <Icon name="question-circle" />
                      </Tooltip>
                    </th>
                    <th style={{ width: '1%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserListItem user={user} showLicensedRole={showLicensedRole} showUnits={showUnits} key={user.id} />
                  ))}
                </tbody>
              </table>
            </div>
            {showPaging && <Pagination numberOfPages={totalPages} currentPage={page} onNavigate={changePage} />}
          </>
        )}
      </Page.Contents>
    </Page>
  );
};

const iconMap = new Map<string, IconName>([
  ['dashboard', 'apps'],
  ['folder', 'folder'],
]);

type UserListItemProps = {
  user: UserDTO;
  showLicensedRole: boolean;
  showUnits: boolean;
};
const UserListItem = memo(({ user, showUnits, showLicensedRole }: UserListItemProps) => {
  const styles = useStyles2(getStyles);
  const editUrl = `admin/users/edit/${user.id}`;

  return (
    <tr key={user.id}>
      <td className="width-4 text-center link-td">
        <a href={editUrl} aria-label={`Edit user's ${user.name} details`}>
          <img className="filter-table__avatar" src={user.avatarUrl} alt={`Avatar for user ${user.name}`} />
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" href={editUrl} title={user.login} aria-label={`Edit user's ${user.name} details`}>
          {user.login}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" href={editUrl} title={user.email} aria-label={`Edit user's ${user.name} details`}>
          {user.email}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" href={editUrl} title={user.name} aria-label={`Edit user's ${user.name} details`}>
          {user.name}
        </a>
      </td>
      <td className="link-td">
        {user.isAdmin && (
          <a href={editUrl} aria-label={`Edit user's ${user.name} details`}>
            <Tooltip placement="top" content="Grafana Admin">
              <Icon name="shield" />
            </Tooltip>
          </a>
        )}
      </td>
      {showUnits && (
        <td className={cx('link-td', styles.iconRow, styles.row)}>
          <OrgUnits units={user.orgs} icon={'building'} />
          <OrgUnits units={user.teams} icon={'users-alt'} />
        </td>
      )}
      {showLicensedRole && (
        <td className={cx('link-td', styles.iconRow)}>
          <a className="ellipsis" href={editUrl} title={user.name} aria-label={`Edit user's ${user.name} details`}>
            {user.licensedRole}{' '}
            {user.permissions?.map((permission) =>
              iconMap.has(permission) ? <Icon name={iconMap.get(permission)!} /> : null
            )}
          </a>
        </td>
      )}
      <td className="link-td">
        {user.lastSeenAtAge && (
          <a
            href={editUrl}
            aria-label={`Last seen at ${user.lastSeenAtAge}. Follow to edit user's ${user.name} details.`}
          >
            {user.lastSeenAtAge}
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
});

UserListItem.displayName = 'UserListItem';

type OrgUnitProps = { units?: Unit[]; icon: IconName };

const OrgUnits = ({ units, icon }: OrgUnitProps) => {
  const styles = useStyles2(getStyles);

  if (!units?.length) {
    return null;
  }

  return units.length > 1 ? (
    <Tooltip
      placement={'top'}
      content={
        <div className={styles.unitTooltip}>
          {units?.map((unit) => (
            <a href={unit.url} title={unit.name} key={unit.name} aria-label={`Edit ${unit.name}`}>
              {unit.name}
            </a>
          ))}
        </div>
      }
    >
      <div className={styles.unitItem}>
        <Icon name={icon} /> <span>{units.length}</span>
      </div>
    </Tooltip>
  ) : (
    <a
      className="ellipsis"
      href={units[0].url}
      title={units[0].name}
      key={units[0].name}
      aria-label={`Edit ${units[0].name}`}
    >
      <Icon name={'users-alt'} /> {units[0].name}
    </a>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    table: css`
      margin-top: ${theme.spacing(3)};
    `,
    filter: css`
      margin-right: ${theme.spacing(1)};
    `,
    iconRow: css`
      svg {
        margin-left: ${theme.spacing(0.5)};
      }
    `,
    row: css`
      display: flex;
      align-items: center;

      svg {
        margin-left: ${theme.spacing(1)};
      }
    `,
    unitTooltip: css`
      display: flex;
      flex-direction: column;
    `,
    unitItem: css`
      cursor: pointer;
    `,
  };
};

export default connector(UserListAdminPageUnConnected);
