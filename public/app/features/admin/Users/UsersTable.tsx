import { useMemo } from 'react';

import {
  Avatar,
  CellProps,
  Column,
  FetchDataFunc,
  Icon,
  InteractiveTable,
  LinkButton,
  Pagination,
  Stack,
  Tag,
  Text,
  TextLink,
  Tooltip,
} from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { Trans } from 'app/core/internationalization';
import { UserDTO } from 'app/types';

import { OrgUnits } from './OrgUnits';

type Cell<T extends keyof UserDTO = keyof UserDTO> = CellProps<UserDTO, UserDTO[T]>;

export interface UsersTableProps {
  users: UserDTO[];
  showPaging?: boolean;
  totalPages: number;
  onChangePage: (page: number) => void;
  currentPage: number;
  fetchData?: FetchDataFunc<UserDTO>;
}

export const UsersTable = ({
  users,
  showPaging,
  totalPages,
  onChangePage,
  currentPage,
  fetchData,
}: UsersTableProps) => {
  const showLicensedRole = useMemo(() => users.some((user) => user.licensedRole), [users]);
  const showBelongsTo = useMemo(() => users.some((user) => user.orgs), [users]);

  const columns: Array<Column<UserDTO>> = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        cell: ({ cell: { value } }: Cell<'avatarUrl'>) => value && <Avatar src={value} alt={'User avatar'} />,
      },
      {
        id: 'login',
        header: 'Login',
        cell: ({ row: { original } }: Cell<'login'>) => {
          return (
            <TextLink color="primary" inline={false} href={`/admin/users/edit/${original.uid}`} title="Edit user">
              {original.login}
            </TextLink>
          );
        },
        sortType: 'string',
      },
      {
        id: 'email',
        header: 'Email',
        cell: ({ cell: { value } }: Cell<'email'>) => value,
        sortType: 'string',
      },
      {
        id: 'name',
        header: 'Name',
        cell: ({ cell: { value } }: Cell<'name'>) => value,
        sortType: 'string',
      },
      ...(showBelongsTo
        ? [
            {
              id: 'orgs',
              header: 'Belongs to',
              cell: ({ cell: { value, row } }: Cell<'orgs'>) => {
                return (
                  <Stack alignItems={'center'}>
                    <OrgUnits units={value} icon={'building'} />
                    {row.original.isAdmin && (
                      <Tooltip placement="top" content="Grafana Admin">
                        <Icon name="shield" />
                      </Tooltip>
                    )}
                  </Stack>
                );
              },
            },
          ]
        : []),
      ...(showLicensedRole
        ? [
            {
              id: 'licensedRole',
              header: 'Licensed role',
              cell: ({ cell: { value } }: Cell<'licensedRole'>) => {
                return value === 'None' ? (
                  <Text color={'disabled'}>
                    <Trans i18nKey="admin.users-table.no-licensed-roles">Not assigned</Trans>
                    <Tooltip placement="top" content="A licensed role will be assigned when this user signs in">
                      <Icon name="question-circle" style={{ margin: '0 0 4 4' }} />
                    </Tooltip>
                  </Text>
                ) : (
                  value
                );
              },
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
        cell: ({ cell: { value } }: Cell<'lastSeenAtAge'>) => {
          return (
            <>
              {value && (
                <>
                  {value === '10 years' ? (
                    <Text color={'disabled'}>
                      <Trans i18nKey="admin.users-table.last-seen-never">Never</Trans>
                    </Text>
                  ) : (
                    value
                  )}
                </>
              )}
            </>
          );
        },
        sortType: (a, b) => new Date(a.original.lastSeenAt!).getTime() - new Date(b.original.lastSeenAt!).getTime(),
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
      },
      {
        id: 'edit',
        header: '',
        cell: ({ row: { original } }: Cell) => {
          return (
            <LinkButton
              variant="secondary"
              size="sm"
              icon="pen"
              href={`admin/users/edit/${original.uid}`}
              aria-label={`Edit user ${original.name}`}
              tooltip={'Edit user'}
            />
          );
        },
      },
    ],
    [showLicensedRole, showBelongsTo]
  );
  return (
    <Stack direction={'column'} gap={2}>
      <InteractiveTable columns={columns} data={users} getRowId={(user) => String(user.id)} fetchData={fetchData} />
      {showPaging && (
        <Stack justifyContent={'flex-end'}>
          <Pagination numberOfPages={totalPages} currentPage={currentPage} onNavigate={onChangePage} />
        </Stack>
      )}
    </Stack>
  );
};
