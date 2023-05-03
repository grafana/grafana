import React, { useCallback, useEffect, useState } from 'react';

import { getBackendSrv, locationService } from '@grafana/runtime';
import { Form, Button, Input, Field, FieldSet } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions, updateUserRoles } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, OrgRole, Role, ServiceAccountCreateApiResponse, ServiceAccountDTO } from 'app/types';

import { OrgRolePicker } from '../admin/OrgRolePicker';

export interface Props {}

const createServiceAccount = async (sa: ServiceAccountDTO) => {
  const result = await getBackendSrv().post('/api/serviceaccounts/', sa);
  await contextSrv.fetchUserPermissions();
  return result;
};

const updateServiceAccount = async (id: number, sa: ServiceAccountDTO) =>
  getBackendSrv().patch(`/api/serviceaccounts/${id}`, sa);

export const ServiceAccountCreatePage = ({}: Props): JSX.Element => {
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);

  const currentOrgId = contextSrv.user.orgId;
  const [serviceAccount, setServiceAccount] = useState<ServiceAccountDTO>({
    id: 0,
    orgId: contextSrv.user.orgId,
    role: OrgRole.Viewer,
    tokens: 0,
    name: '',
    login: '',
    isDisabled: false,
    createdAt: '',
    teams: [],
  });

  useEffect(() => {
    async function fetchOptions() {
      try {
        if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
          let options = await fetchRoleOptions(currentOrgId);
          setRoleOptions(options);
        }
      } catch (e) {
        console.error('Error loading options', e);
      }
    }
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchOptions();
    }
  }, [currentOrgId]);

  const onSubmit = useCallback(
    async (data: ServiceAccountDTO) => {
      data.role = serviceAccount.role;
      const response = await createServiceAccount(data);
      try {
        const newAccount: ServiceAccountCreateApiResponse = {
          avatarUrl: response.avatarUrl,
          id: response.id,
          isDisabled: response.isDisabled,
          login: response.login,
          name: response.name,
          orgId: response.orgId,
          role: response.role,
          tokens: response.tokens,
        };
        await updateServiceAccount(response.id, data);
        if (
          contextSrv.licensedAccessControlEnabled() &&
          contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
          contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove)
        ) {
          await updateUserRoles(pendingRoles, newAccount.id, newAccount.orgId);
        }
      } catch (e) {
        console.error(e);
      }
      locationService.push(`/org/serviceaccounts/${response.id}`);
    },
    [serviceAccount.role, pendingRoles]
  );

  const onRoleChange = (role: OrgRole) => {
    setServiceAccount({
      ...serviceAccount,
      role: role,
    });
  };

  const onPendingRolesUpdate = (roles: Role[], userId: number, orgId: number | undefined) => {
    // keep the new role assignments for user
    setPendingRoles(roles);
  };

  return (
    <Page navId="serviceaccounts" pageNav={{ text: 'Create service account' }}>
      <Page.Contents>
        <Form onSubmit={onSubmit} validateOn="onSubmit">
          {({ register, errors }) => {
            return (
              <>
                <FieldSet>
                  <Field
                    label="Display name"
                    required
                    invalid={!!errors.name}
                    error={errors.name ? 'Display name is required' : undefined}
                  >
                    <Input id="display-name-input" {...register('name', { required: true })} autoFocus />
                  </Field>
                  <Field label="Role">
                    {contextSrv.licensedAccessControlEnabled() ? (
                      <UserRolePicker
                        apply
                        userId={serviceAccount.id || 0}
                        orgId={serviceAccount.orgId}
                        basicRole={serviceAccount.role}
                        onBasicRoleChange={onRoleChange}
                        roleOptions={roleOptions}
                        onApplyRoles={onPendingRolesUpdate}
                        pendingRoles={pendingRoles}
                        maxWidth="100%"
                      />
                    ) : (
                      <OrgRolePicker aria-label="Role" value={serviceAccount.role} onChange={onRoleChange} />
                    )}
                  </Field>
                </FieldSet>
                <Button type="submit">Create</Button>
              </>
            );
          }}
        </Form>
      </Page.Contents>
    </Page>
  );
};

export default ServiceAccountCreatePage;
