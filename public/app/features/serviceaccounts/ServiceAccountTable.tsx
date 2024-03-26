import React, { useMemo } from 'react';

import {
  Avatar,
  CellProps,
  Column,
  InteractiveTable,
  Pagination,
  Stack,
  LinkButton,
  TextLink,
  Button,
  IconButton,
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
  //fetchData,
}: ServiceAccountTableProps) => {
  const displayRolePicker =
    contextSrv.hasPermission(AccessControlAction.ActionRolesList) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);

  /* @ts-ignore */
  const columns: Array<Column<ServiceAccountDTO>> = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        cell: ({ row: { original } }: Cell<'role'>) => {
          const href = `/org/serviceaccounts/${original.id}`;
          const ariaLabel = `Edit service account's ${name} details`;
          if (!original.avatarUrl) {
            return null;
          }
          return (
            <LinkButton aria-label={ariaLabel} href={href} size="sm" variant="secondary">
              <Avatar src={original.avatarUrl} alt={'User avatar'} />
            </LinkButton>
          );
        },
        sortType: 'string',
      },
      {
        id: 'name',
        header: 'Account',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          const href = `/org/serviceaccounts/${original.id}`;
          const ariaLabel = `Edit service account's ${name} details`;
          if (!original.avatarUrl) {
            return null;
          }
          return (
            <TextLink href={href} aria-label={ariaLabel} color="primary">
              {value}
            </TextLink>
          );
        },
        sortType: 'string',
      },
      {
        id: 'id',
        header: 'ID',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          const href = `/org/serviceaccounts/${original.id}`;
          const ariaLabel = `Edit service account's ${name} details`;
          if (!original.avatarUrl) {
            return null;
          }
          return (
            <TextLink href={href} aria-label={ariaLabel} color="primary">
              {original.login}
            </TextLink>
          );
        },
        sortType: 'string',
      },
      {
        id: 'role',
        header: 'Roles',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, original);
          console.log(canUpdateRole);
          console.log('license', contextSrv.licensedAccessControlEnabled());
          console.log('displayRP', displayRolePicker);
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
        },
      },
      {
        id: 'tokens',
        header: 'Tokens',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          const href = `/org/serviceaccounts/${original.id}`;
          const ariaLabel = `Edit service account's ${name} details`;
          return (
            <TextLink href={href} aria-label={ariaLabel} color="primary">
              {value || 'No tokens'}
            </TextLink>
          );
        },
        sortType: 'number',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row: { original } }: Cell) => {
          return !original.isExternal ? (
            <Stack alignItems="center" justifyContent="flex-end">
              {contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite) && !original.tokens && (
                <Button onClick={() => onAddTokenClick(original)} disabled={original.isDisabled}>
                  Add token
                </Button>
              )}
              {contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, original) &&
                (original.isDisabled ? (
                  <LinkButton
                    variant="secondary"
                    size="sm"
                    aria-label={`Enable service account ${original.name}`}
                    onClick={() => onEnable(original)}
                  >
                    Enable
                  </LinkButton>
                ) : (
                  <LinkButton
                    variant="secondary"
                    size="sm"
                    aria-label={`Disable service account ${original.name}`}
                    onClick={() => onDisable(original)}
                  >
                    Disable
                  </LinkButton>
                ))}

              {contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsDelete, original) && (
                <Button
                  icon="trash-alt"
                  aria-label={`Remove service account ${original.name}`}
                  variant="primary"
                  fill="outline"
                  size="sm"
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
        },
      },
    ],
    [displayRolePicker, onAddTokenClick, onDisable, onEnable, onRemoveButtonClick, onRoleChange, roleOptions]
  );
  return (
    <Stack direction={'column'} gap={2}>
      <InteractiveTable
        columns={columns}
        data={services}
        getRowId={(service) => String(service.id)}
        //fetchData={fetchData}
      />
      {showPaging && (
        <Stack justifyContent={'flex-end'}>
          <Pagination numberOfPages={totalPages} currentPage={currentPage} onNavigate={onChangePage} />
        </Stack>
      )}
    </Stack>
  );
};
