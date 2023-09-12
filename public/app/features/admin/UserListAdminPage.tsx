import { css } from '@emotion/css';
import React, { ComponentType, useEffect, useMemo } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Row } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import {
  Icon,
  IconName,
  LinkButton,
  SortByFn,
  RadioButtonGroup,
  Tooltip,
  useStyles2,
  FilterInput,
  CellProps,
  InteractiveTable,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { contextSrv } from 'app/core/core';

import PageLoader from '../../core/components/PageLoader/PageLoader';
import { AccessControlAction, StoreState, Unit, UserDTO, UserFilter } from '../../types';

import { changeFilter, changePage, changeQuery, fetchUsers } from './state/actions';

export interface FilterProps {
  filters: UserFilter[];
  onChange: (filter: UserFilter) => void;
  className?: string;
}
const extraFilters: Array<ComponentType<FilterProps>> = [];
export const addExtraFilters = (filter: ComponentType<FilterProps>) => {
  extraFilters.push(filter);
};

const selectors = e2eSelectors.pages.UserListPage.UserListAdminPage;

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
  perPage: state.userListAdmin.perPage,
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
  perPage,
  changeFilter,
  filters,
  isLoading,
}: Props) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showLicensedRole = useMemo(() => users.some((user) => user.licensedRole), [users]);

  type Cell<T extends keyof UserDTO> = CellProps<UserDTO, UserDTO[T]>;
  const createSortFn =
    (key: keyof UserDTO): SortByFn<UserDTO> =>
    (a, b) => {
      const aValue = a.original[key];
      const bValue = b.original[key];
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return aValue - bValue;
      } else if (
        typeof aValue === 'string' &&
        typeof bValue === 'string' &&
        !isNaN(Date.parse(aValue)) &&
        !isNaN(Date.parse(bValue))
      ) {
        return new Date(aValue).getTime() - new Date(bValue).getTime();
      } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return aValue === bValue ? 0 : aValue ? -1 : 1;
      }
      return a.original.login.localeCompare(b.original.login);
    };

  const columns = [
    {
      id: 'avatarUrl',
      header: '',
      cell: ({ cell: { value } }: Cell<'avatarUrl'>) => (
        <img style={{ width: '25px', height: '25px', borderRadius: '50%' }} src={value} alt="User avatar" />
      ),
    },
    {
      id: 'login',
      header: 'Login',
      cell: ({ cell: { value } }: Cell<'login'>) => <div>{value}</div>,
      sortType: createSortFn('login'),
    },
    {
      id: 'email',
      header: 'Email',
      cell: ({ cell: { value } }: Cell<'email'>) => <div>{value}</div>,
      sortType: createSortFn('email'),
    },
    {
      id: 'name',
      header: 'Name',
      cell: ({ cell: { value } }: Cell<'name'>) => <div>{value}</div>,
      sortType: createSortFn('name'),
    },
    {
      id: 'orgs',
      header: 'Belongs to',
      cell: ({ cell: { value, row } }: Cell<'orgs'>) => {
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <OrgUnits units={value} icon={'building'} />
            {row.original.isAdmin && (
              <a href={`admin/users/edit/${row.original.id}`} aria-label={getUsersAriaLabel(row.original.name)}>
                <Tooltip placement="top" content="Grafana Admin">
                  <Icon name="shield" />
                </Tooltip>
              </a>
            )}
          </div>
        );
      },
      sortType: (a: Row<UserDTO>, b: Row<UserDTO>) => (a.original.orgs?.length || 0) - (b.original.orgs?.length || 0),
    },
    ...(showLicensedRole
      ? [
          {
            id: 'licensedRole',
            header: 'Licensed role',
            cell: ({ cell: { value, row } }: Cell<'licensedRole'>) => (
              <div>
                <a
                  className="ellipsis"
                  href={`admin/users/edit/${row.original.id}`}
                  title={row.original.name}
                  aria-label={getUsersAriaLabel(row.original.name)}
                >
                  {value === 'None' ? (
                    <span className={styles.disabled}>
                      Not assigned{' '}
                      <Tooltip placement="top" content="A licensed role will be assigned when this user signs in">
                        <Icon name="question-circle" />
                      </Tooltip>
                    </span>
                  ) : (
                    value
                  )}
                </a>
              </div>
            ),
            sortType: createSortFn('licensedRole'),
          },
        ]
      : []),
    {
      id: 'lastSeenAtAge',
      header: 'Last active',
      headerTooltip: {
        content: 'Time since user was seen using Grafana',
        iconName: 'question-circle',
      },
      cell: ({ cell: { value, row } }: Cell<'lastSeenAtAge'>) => {
        const { name, id } = row.original;
        return (
          <div>
            {value && (
              <a
                href={`admin/users/edit/${id}`}
                aria-label={`Last seen at ${value}. Follow to edit user's ${name} details.`}
              >
                {value === '10 years' ? <span className={styles.disabled}>Never</span> : value}
              </a>
            )}
          </div>
        );
      },
      sortType: createSortFn('lastSeenAt'),
    },
    {
      id: 'authLabels',
      header: 'Origin',
      cell: ({ cell: { value } }: Cell<'authLabels'>) => (
        <>{Array.isArray(value) && value.length > 0 && <TagBadge label={value[0]} removeIcon={false} count={0} />}</>
      ),
    },
    {
      id: 'isDisabled',
      header: 'Status',
      cell: ({ cell: { value } }: Cell<'isDisabled'>) => (
        <>{value && <span className="label label-tag label-tag--gray">Disabled</span>}</>
      ),
      sortType: createSortFn('isDisabled'),
    },
  ];

  return (
    <Page.Contents>
      <div className="page-action-bar" data-testid={selectors.container}>
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
        <InteractiveTable
          columns={columns}
          data={users}
          getRowId={(user) => String(user.id)}
          pageSize={showPaging ? perPage : 0}
        />
      )}
    </Page.Contents>
  );
};

export const UserListAdminPageContent = connector(UserListAdminPageUnConnected);
export function UserListAdminPage() {
  return (
    <Page navId="global-users">
      <UserListAdminPageContent />
    </Page>
  );
}

const getUsersAriaLabel = (name: string) => {
  return `Edit user's ${name} details`;
};

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

export default UserListAdminPage;
