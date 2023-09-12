import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { Row } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { InteractiveTable, CellProps, Tooltip, Icon, useStyles2, Tag } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { UserDTO } from 'app/types';

import { OrgUnits } from './OrgUnits';
import { UserCell, CellWrapper } from './UserCell';
import { createSortFn } from './sort';

type Cell<T extends keyof UserDTO> = CellProps<UserDTO, UserDTO[T]>;

interface UsersTableProps {
  users: UserDTO[];
  showPaging?: boolean;
  perPage?: number;
}

export const UsersTable = ({ users, showPaging, perPage }: UsersTableProps) => {
  const styles = useStyles2(getStyles);
  const showLicensedRole = useMemo(() => users.some((user) => user.licensedRole), [users]);
  const columns = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        cell: ({ cell: { value } }: Cell<'avatarUrl'>) => (
          <img className={styles.image} src={value} alt="User avatar" />
        ),
      },
      {
        id: 'login',
        header: 'Login',
        cell: UserCell,
        sortType: createSortFn<UserDTO>('login'),
      },
      {
        id: 'email',
        header: 'Email',
        cell: UserCell,
        sortType: createSortFn<UserDTO>('email'),
      },
      {
        id: 'name',
        header: 'Name',
        cell: UserCell,
        sortType: createSortFn<UserDTO>('name'),
      },
      {
        id: 'orgs',
        header: 'Belongs to',
        cell: ({ cell: { value, row } }: Cell<'orgs'>) => {
          return (
            <div className={styles.row}>
              <OrgUnits units={value} icon={'building'} />
              {row.original.isAdmin && (
                <CellWrapper original={row.original}>
                  <Tooltip placement="top" content="Grafana Admin">
                    <Icon name="shield" />
                  </Tooltip>
                </CellWrapper>
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
                <CellWrapper original={row.original}>
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
                </CellWrapper>
              ),
              sortType: createSortFn<UserDTO>('licensedRole'),
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
          return (
            <>
              {value && (
                <CellWrapper original={row.original}>
                  {value === '10 years' ? <span className={styles.disabled}>Never</span> : value}
                </CellWrapper>
              )}
            </>
          );
        },
        sortType: createSortFn<UserDTO>('lastSeenAt'),
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
        cell: ({ cell: { value } }: Cell<'isDisabled'>) => <>{value && <Tag colorIndex={9} name={'Disabled'} />}</>,
        sortType: createSortFn<UserDTO>('isDisabled'),
      },
    ],
    [showLicensedRole, styles]
  );
  return (
    <InteractiveTable
      columns={columns}
      data={users}
      getRowId={(user) => String(user.id)}
      pageSize={showPaging ? perPage : 0}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    disabled: css`
      color: ${theme.colors.text.disabled};
    `,
    image: css`
      width: 25px;
      height: 25px;
      border-radius: 50%;
    `,
    row: css`
      display: flex;
      align-items: center;
    `,
  };
};
