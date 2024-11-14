import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import {
  Avatar,
  CellProps,
  Column,
  InteractiveTable,
  Pagination,
  Stack,
  TextLink,
  Button,
  IconButton,
  Icon,
} from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, OrgRole, Role, ServiceAccountDTO } from 'app/types';

import { OrgRolePicker } from '../admin/OrgRolePicker';

type Cell<T extends keyof ServiceAccountDTO = keyof ServiceAccountDTO> = CellProps<
  ServiceAccountDTO,
  ServiceAccountDTO[T]
>;

interface ServiceAccountTableProps {
  services: ServiceAccountDTO[];
  onRoleChange: (role: OrgRole, serviceAccount: ServiceAccountDTO) => void;
  roleOptions: Role[];
  onRemoveButtonClick: (serviceAccount: ServiceAccountDTO) => void;
  onDisable: (serviceAccount: ServiceAccountDTO) => void;
  onEnable: (serviceAccount: ServiceAccountDTO) => void;
  onAddTokenClick: (serviceAccount: ServiceAccountDTO) => void;
  showPaging?: boolean;
  totalPages: number;
  onChangePage: (page: number) => void;
  currentPage: number;
  isLoading: boolean;
}

export const ServiceAccountTable = ({
  services,
  onRoleChange,
  roleOptions,
  onRemoveButtonClick,
  onDisable,
  onEnable,
  onAddTokenClick,
  showPaging,
  totalPages,
  onChangePage,
  currentPage,
  isLoading,
}: ServiceAccountTableProps) => {
  const columns: Array<Column<ServiceAccountDTO>> = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          return getCellContent(value, original, isLoading, 'avatarUrl');
        },
      },
      {
        id: 'name',
        header: 'Account',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          return getCellContent(value, original, isLoading);
        },
        sortType: 'string',
      },
      {
        id: 'id',
        header: 'ID',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          return getCellContent(value, original, isLoading, 'id');
        },
      },
      {
        id: 'role',
        header: 'Roles',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          return getRoleCell(value, original, isLoading, roleOptions, onRoleChange);
        },
      },
      {
        id: 'tokens',
        header: 'Tokens',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          return getCellContent(value, original, isLoading, 'tokens');
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row: { original } }: Cell) => {
          return getActionsCell(original, isLoading, onAddTokenClick, onEnable, onDisable, onRemoveButtonClick);
        },
      },
    ],
    [isLoading, onAddTokenClick, onDisable, onEnable, onRemoveButtonClick, onRoleChange, roleOptions]
  );
  return (
    <Stack direction={'column'} gap={2}>
      <InteractiveTable columns={columns} data={services} getRowId={(service) => String(service.id)} />
      {showPaging && totalPages > 1 && (
        <Stack justifyContent={'flex-end'}>
          <Pagination numberOfPages={totalPages} currentPage={currentPage} onNavigate={onChangePage} />
        </Stack>
      )}
    </Stack>
  );
};

const getCellContent = (
  value: string,
  original: ServiceAccountDTO,
  isLoading: boolean,
  columnName?: Column<ServiceAccountDTO>['id']
) => {
  if (isLoading) {
    return columnName === 'avatarUrl' ? <Skeleton circle width={24} height={24} /> : <Skeleton width={100} />;
  }
  const href = `/org/serviceaccounts/${original.uid}`;
  const ariaLabel = `Edit service account's ${name} details`;
  switch (columnName) {
    case 'avatarUrl':
      return (
        <a aria-label={ariaLabel} href={href}>
          <Avatar src={value} alt={'User avatar'} />
        </a>
      );
    case 'id':
      return (
        <TextLink href={href} aria-label={ariaLabel} color="secondary" inline={false}>
          {original.login}
        </TextLink>
      );
    case 'tokens':
      return (
        <Stack alignItems="center">
          <Icon name="key-skeleton-alt" />
          <TextLink href={href} aria-label={ariaLabel} color="primary" inline={false}>
            {value || 'No tokens'}
          </TextLink>
        </Stack>
      );
    default:
      return (
        <TextLink href={href} aria-label={ariaLabel} color="primary" inline={false}>
          {value}
        </TextLink>
      );
  }
};

const getRoleCell = (
  value: OrgRole,
  original: ServiceAccountDTO,
  isLoading: boolean,
  roleOptions: Role[],
  onRoleChange: (role: OrgRole, serviceAccount: ServiceAccountDTO) => void
) => {
  const displayRolePicker =
    contextSrv.hasPermission(AccessControlAction.ActionRolesList) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);
  const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, original);

  if (isLoading) {
    return <Skeleton width={100} />;
  } else {
    return contextSrv.licensedAccessControlEnabled() ? (
      displayRolePicker && (
        <UserRolePicker
          userId={original.id}
          orgId={original.orgId}
          basicRole={value}
          roles={original.roles || []}
          onBasicRoleChange={(newRole) => onRoleChange(newRole, original)}
          roleOptions={roleOptions}
          basicRoleDisabled={!canUpdateRole}
          disabled={original.isExternal || original.isDisabled}
          width={40}
        />
      )
    ) : (
      <OrgRolePicker
        aria-label="Role"
        value={value}
        disabled={original.isExternal || !canUpdateRole || original.isDisabled}
        onChange={(newRole) => onRoleChange(newRole, original)}
      />
    );
  }
};

const getActionsCell = (
  original: ServiceAccountDTO,
  isLoading: boolean,
  onAddTokenClick: (serviceAccount: ServiceAccountDTO) => void,
  onEnable: (serviceAccount: ServiceAccountDTO) => void,
  onDisable: (serviceAccount: ServiceAccountDTO) => void,
  onRemoveButtonClick: (serviceAccount: ServiceAccountDTO) => void
) => {
  if (isLoading) {
    return <Skeleton width={100} />;
  } else {
    return !original.isExternal ? (
      <Stack alignItems="center" justifyContent="flex-end">
        {contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite) && !original.tokens && (
          <Button onClick={() => onAddTokenClick(original)} disabled={original.isDisabled}>
            Add token
          </Button>
        )}
        {contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, original) &&
          (original.isDisabled ? (
            <Button variant="secondary" size="md" onClick={() => onEnable(original)}>
              Enable
            </Button>
          ) : (
            <Button variant="secondary" size="md" onClick={() => onDisable(original)}>
              Disable
            </Button>
          ))}

        {contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsDelete, original) && (
          <IconButton
            name="trash-alt"
            aria-label={`Delete service account ${original.name}`}
            variant="secondary"
            onClick={() => onRemoveButtonClick(original)}
          />
        )}
      </Stack>
    ) : (
      <Stack alignItems="center" justifyContent="flex-end">
        <IconButton
          disabled={true}
          name="lock"
          size="md"
          tooltip={`This is a managed service account and cannot be modified.`}
        />
      </Stack>
    );
  }
};

ServiceAccountTable.displayName = 'ServiceAccountTable';
