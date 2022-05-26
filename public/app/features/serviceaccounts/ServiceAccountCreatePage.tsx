import React, { useCallback, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { NavModel } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Form, Button, Input, Field } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchBuiltinRoles, fetchRoleOptions, updateUserRoles } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, OrgRole, Role, ServiceAccountCreateApiResponse, ServiceAccountDTO } from 'app/types';

import { getNavModel } from '../../core/selectors/navModel';
import { StoreState } from '../../types';

interface ServiceAccountCreatePageProps {
  navModel: NavModel;
}

const createServiceAccount = async (sa: ServiceAccountDTO) => getBackendSrv().post('/api/serviceaccounts/', sa);
const updateServiceAccount = async (id: number, sa: ServiceAccountDTO) =>
  getBackendSrv().patch(`/api/serviceaccounts/${id}`, sa);

const ServiceAccountCreatePage: React.FC<ServiceAccountCreatePageProps> = ({ navModel }) => {
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [builtinRoles, setBuiltinRoles] = useState<{ [key: string]: Role[] }>({});
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

        if (contextSrv.hasPermission(AccessControlAction.ActionBuiltinRolesList)) {
          const builtInRoles = await fetchBuiltinRoles(currentOrgId);
          setBuiltinRoles(builtInRoles);
        }
      } catch (e) {
        console.error('Error loading options', e);
      }
    }
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchOptions();
    }
  }, [currentOrgId]);

  const history = useHistory();

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
        await updateUserRoles(pendingRoles, newAccount.id, newAccount.orgId);
      } catch (e) {
        console.error(e);
      }
      history.push('/org/serviceaccounts/');
    },
    [history, serviceAccount.role, pendingRoles]
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
    <Page navModel={navModel}>
      <Page.Contents>
        <h1>Create service account</h1>
        <Form onSubmit={onSubmit} validateOn="onBlur">
          {({ register, errors }) => {
            return (
              <>
                <Field
                  label="Display name"
                  required
                  invalid={!!errors.name}
                  error={errors.name ? 'Display name is required' : undefined}
                >
                  <Input id="display-name-input" {...register('name', { required: true })} />
                </Field>
                {contextSrv.accessControlEnabled() && (
                  <Field label="Role">
                    <UserRolePicker
                      userId={serviceAccount.id || 0}
                      orgId={serviceAccount.orgId}
                      builtInRole={serviceAccount.role}
                      builtInRoles={builtinRoles}
                      onBuiltinRoleChange={(newRole) => onRoleChange(newRole)}
                      builtinRolesDisabled={false}
                      roleOptions={roleOptions}
                      updateDisabled={true}
                      onApplyRoles={onPendingRolesUpdate}
                      pendingRoles={pendingRoles}
                    />
                  </Field>
                )}
                <Button type="submit">Create</Button>
              </>
            );
          }}
        </Form>
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'serviceaccounts'),
});

export default connect(mapStateToProps)(ServiceAccountCreatePage);
