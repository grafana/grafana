import { css, cx } from '@emotion/css';
import React, { ComponentType, useEffect, useMemo, memo } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Icon,
  IconName,
  LinkButton,
  Pagination,
  RadioButtonGroup,
  Tooltip,
  useStyles2,
  FilterInput,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { contextSrv } from 'app/core/core';

import PageLoader from '../../core/components/PageLoader/PageLoader';
import { AccessControlAction, StoreState, Unit, UserDTO, UserFilter } from '../../types';

import { changeFilter, changePage, changeQuery, fetchUsers } from './state/actions';

export interface FilterProps {
  filters: UserFilter[];
  onChange: (filter: any) => void;
  className?: string;
}
const extraFilters: Array<ComponentType<FilterProps>> = [];
export const addExtraFilters = (filter: ComponentType<FilterProps>) => {
  extraFilters.push(filter);
};

const mapDispatchToProps = {
  fetchUsers,
  changeQuery,
  changePage,
  changeFilter,
};

const mapStateToProps = (state: StoreState) => ({
  users: state.userListAdmin.users,
  query: state.userListAdmin.query,
  showPaging: state.userListAdmin.showPaging,
  totalPages: state.userListAdmin.totalPages,
  page: state.userListAdmin.page,
  filters: state.userListAdmin.filters,
  isLoading: state.userListAdmin.isLoading,
});

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

const UserListAdminPageUnConnected = ({
  fetchUsers,
  query,
  changeQuery,
  users,
  showPaging,
  totalPages,
  page,
  changePage,
  changeFilter,
  filters,
  isLoading,
}: Props) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showLicensedRole = useMemo(() => users.some((user) => user.licensedRole), [users]);

  return (
    <Page navId="global-users" subTitle="Manage and create users across the whole Grafana server.">
      <Page.Contents>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <FilterInput
              placeholder="Search user by login, email, or name."
              autoFocus={true}
              value={query}
              onChange={changeQuery}
            />
            <RadioButtonGroup
              options={[
                { label: 'All users', value: false },
                { label: 'Active last 30 days', value: true },
              ]}
              onChange={(value) => changeFilter({ name: 'activeLast30Days', value })}
              value={filters.find((f) => f.name === 'activeLast30Days')?.value}
              className={styles.filter}
            />
            {extraFilters.map((FilterComponent, index) => (
              <FilterComponent key={index} filters={filters} onChange={changeFilter} className={styles.filter} />
            ))}
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
                    <th>Belongs to</th>
                    {showLicensedRole && (
                      <th>
                        Licensed role{' '}
                        <Tooltip
                          placement="top"
                          content={
                            <>
                              Licensed role is based on a user&apos;s Org role (i.e. Viewer, Editor, Admin) and their
                              dashboard/folder permissions.{' '}
                              <a
                                className={styles.link}
                                target="_blank"
                                rel="noreferrer noopener"
                                href={
                                  'https://grafana.com/docs/grafana/next/enterprise/license/license-restrictions/#active-users-limit'
                                }
                              >
                                Learn more
                              </a>
                            </>
                          }
                        >
                          <Icon name="question-circle" />
                        </Tooltip>
                      </th>
                    )}
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
                    <UserListItem user={user} showLicensedRole={showLicensedRole} key={user.id} />
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

const getUsersAriaLabel = (name: string) => {
  return `Edit user's ${name} details`;
};

type UserListItemProps = {
  user: UserDTO;
  showLicensedRole: boolean;
};

const UserListItem = memo(({ user, showLicensedRole }: UserListItemProps) => {
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
        <a className="ellipsis" href={editUrl} title={user.login} aria-label={getUsersAriaLabel(user.name)}>
          {user.login}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" href={editUrl} title={user.email} aria-label={getUsersAriaLabel(user.name)}>
          {user.email}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" href={editUrl} title={user.name} aria-label={getUsersAriaLabel(user.name)}>
          {user.name}
        </a>
      </td>

      <td
        className={styles.row}
        title={
          user.orgs?.length
            ? `The user is a member of the following organizations: ${user.orgs.map((org) => org.name).join(',')}`
            : undefined
        }
      >
        <OrgUnits units={user.orgs} icon={'building'} />
        {user.isAdmin && (
          <a href={editUrl} aria-label={getUsersAriaLabel(user.name)}>
            <Tooltip placement="top" content="Grafana Admin">
              <Icon name="shield" />
            </Tooltip>
          </a>
        )}
      </td>
      {showLicensedRole && (
        <td className={cx('link-td', styles.iconRow)}>
          <a className="ellipsis" href={editUrl} title={user.name} aria-label={getUsersAriaLabel(user.name)}>
            {user.licensedRole === 'None' ? (
              <span className={styles.disabled}>
                Not assigned{' '}
                <Tooltip placement="top" content="A licensed role will be assigned when this user signs in">
                  <Icon name="question-circle" />
                </Tooltip>
              </span>
            ) : (
              user.licensedRole
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
            {user.lastSeenAtAge === '10 years' ? <span className={styles.disabled}>Never</span> : user.lastSeenAtAge}
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
            <a
              href={unit.url}
              className={styles.link}
              title={unit.name}
              key={unit.name}
              aria-label={`Edit ${unit.name}`}
            >
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
      href={units[0].url}
      className={styles.unitItem}
      title={units[0].name}
      key={units[0].name}
      aria-label={`Edit ${units[0].name}`}
    >
      <Icon name={icon} /> {units[0].name}
    </a>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    table: css`
      margin-top: ${theme.spacing(3)};
    `,
    filter: css`
      margin: 0 ${theme.spacing(1)};
    `,
    iconRow: css`
      svg {
        margin-left: ${theme.spacing(0.5)};
      }
    `,
    row: css`
      display: flex;
      align-items: center;
      height: 100% !important;

      a {
        padding: ${theme.spacing(0.5)} 0 !important;
      }
    `,
    unitTooltip: css`
      display: flex;
      flex-direction: column;
    `,
    unitItem: css`
      cursor: pointer;
      padding: ${theme.spacing(0.5)} 0;
      margin-right: ${theme.spacing(1)};
    `,
    disabled: css`
      color: ${theme.colors.text.disabled};
    `,
    link: css`
      color: inherit;
      cursor: pointer;
      text-decoration: underline;
    `,
  };
};

export default connector(UserListAdminPageUnConnected);
