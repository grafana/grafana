import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { Row } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { InteractiveTable, CellProps, Tooltip, Icon, useStyles2, Tag } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { UserDTO } from 'app/types';

import { Avatar } from './Avatar';
import { OrgUnits } from './OrgUnits';
import { createSortFn } from './sort';

type Cell<T extends keyof UserDTO = keyof UserDTO> = CellProps<UserDTO, UserDTO[T]>;

interface UsersTableProps {
  users: UserDTO[];
  showPaging?: boolean;
  perPage?: number;
}

export const UsersTable = ({ users, showPaging, perPage }: UsersTableProps) => {
  const showLicensedRole = useMemo(() => users.some((user) => user.licensedRole), [users]);
  const columns = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        cell: ({ cell: { value } }: Cell<'avatarUrl'>) => <Avatar src={value} alt={'User avatar'} />,
      },
      {
        id: 'login',
        header: 'Login',
        cell: ({ cell: { value } }: Cell<'login'>) => value,
        sortType: createSortFn<UserDTO>('login'),
      },
      {
        id: 'email',
        header: 'Email',
        cell: ({ cell: { value } }: Cell<'email'>) => value,
        sortType: createSortFn<UserDTO>('email'),
      },
      {
        id: 'name',
        header: 'Name',
        cell: ({ cell: { value } }: Cell<'name'>) => value,
        sortType: createSortFn<UserDTO>('name'),
      },
      {
        id: 'orgs',
        header: 'Belongs to',
        cell: OrgUnitsCell,
        sortType: (a: Row<UserDTO>, b: Row<UserDTO>) => (a.original.orgs?.length || 0) - (b.original.orgs?.length || 0),
      },
      ...(showLicensedRole
        ? [
            {
              id: 'licensedRole',
              header: 'Licensed role',
              cell: LicensedRoleCell,
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
        cell: LastSeenAtCell,
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
        header: '',
        cell: ({ cell: { value } }: Cell<'isDisabled'>) => <>{value && <Tag colorIndex={9} name={'Disabled'} />}</>,
        sortType: createSortFn<UserDTO>('isDisabled'),
      },
      {
        id: 'edit',
        header: '',
        cell: ({ row: { original } }: Cell) => {
          return (
            <a href={`admin/users/edit/${original.id}`} aria-label={`Edit team ${original.name}`}>
              <Tooltip content={'Edit user'}>
                <Icon name={'pen'} />
              </Tooltip>
            </a>
          );
        },
      },
    ],
    [showLicensedRole]
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

const OrgUnitsCell = ({ cell: { value, row } }: Cell<'orgs'>) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.row}>
      <OrgUnits units={value} icon={'building'} />
      {row.original.isAdmin && (
        <Tooltip placement="top" content="Grafana Admin">
          <Icon name="shield" />
        </Tooltip>
      )}
    </div>
  );
};

const LicensedRoleCell = ({ cell: { value } }: Cell<'licensedRole'>) => {
  const styles = useStyles2(getStyles);

  return (
    <>
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
    </>
  );
};

const LastSeenAtCell = ({ cell: { value } }: Cell<'lastSeenAtAge'>) => {
  const styles = useStyles2(getStyles);

  return <>{value && <>{value === '10 years' ? <span className={styles.disabled}>Never</span> : value}</>}</>;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    disabled: css`
      color: ${theme.colors.text.disabled};
    `,
    row: css`
      display: flex;
      align-items: center;
    `,
  };
};
