import { useCallback, useEffect, useState, type JSX } from 'react';

import { OrgRole } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { Button, Input, Field, FieldSet } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { Page } from 'app/core/components/Page/Page';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions, updateUserRoles } from 'app/core/components/RolePicker/api';
import { AssignRoles } from 'app/core/components/RolePickerDrawer/AssignRoles';
import { contextSrv } from 'app/core/services/context_srv';
import { Role, AccessControlAction } from 'app/types/accessControl';
import { ServiceAccountDTO, ServiceAccountCreateApiResponse } from 'app/types/serviceaccount';

import { OrgRolePicker } from '../admin/OrgRolePicker';

export interface Props {}

const createServiceAccount = async (sa: ServiceAccountDTO) => {
  const result = await getBackendSrv().post('/api/serviceaccounts/', sa);
  await contextSrv.fetchUserPermissions();
  return result;
};

const updateServiceAccount = async (uid: string, sa: ServiceAccountDTO) =>
  getBackendSrv().patch(`/api/serviceaccounts/${uid}`, sa);

const defaultServiceAccount = {
  id: 0,
  uid: '',
  orgId: contextSrv.user.orgId,
  role: contextSrv.licensedAccessControlEnabled() ? OrgRole.None : OrgRole.Viewer,
  tokens: 0,
  name: '',
  login: '',
  isDisabled: false,
  createdAt: '',
  teams: [],
};

export const ServiceAccountCreatePage = ({}: Props): JSX.Element => {
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);

  const currentOrgId = contextSrv.user.orgId;
  const [serviceAccount, setServiceAccount] = useState<ServiceAccountDTO>(defaultServiceAccount);

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
          uid: response.uid,
          isDisabled: response.isDisabled,
          login: response.login,
          name: response.name,
          orgId: response.orgId,
          role: response.role,
          tokens: response.tokens,
        };
        await updateServiceAccount(newAccount.uid, data);
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
      locationService.push(`/org/serviceaccounts/edit/${response.uid}/information`);
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
    setPendingRoles(roles);
  };

  const handleInlineChange = (newRoles: Role[], newBasicRole?: OrgRole) => {
    setPendingRoles(newRoles);
    if (newBasicRole !== undefined) {
      setServiceAccount((prev) => ({ ...prev, role: newBasicRole }));
    }
  };

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  return (
    <Page
      navId="serviceaccounts"
      pageNav={{ text: t('service-account-create-page.page-nav.label', 'Create service account') }}
    >
      <Page.Contents>
        {config.featureToggles.rolePickerDrawer ? (
          <Form onSubmit={onSubmit} validateOn="onSubmit">
            {({ register, errors }) => (
              <>
                <FieldSet>
                  <Field
                    label={t('service-account-create-page.name.label', 'Display name')}
                    required
                    invalid={!!errors.name}
                    error={
                      errors.name
                        ? t('service-account-create-page.name.required-error', 'Display name is required')
                        : undefined
                    }
                  >
                    <Input id="display-name-input" {...register('name', { required: true })} autoFocus />
                  </Field>
                </FieldSet>
                <AssignRoles
                  basicRole={serviceAccount.role}
                  appliedRoles={[]}
                  roleOptions={roleOptions}
                  canUpdateRoles={canUpdateRoles}
                  onChange={handleInlineChange}
                />
                <div style={{ marginTop: 16 }}>
                  <Button type="submit">
                    <Trans i18nKey="service-account-create-page.create.button">Create</Trans>
                  </Button>
                </div>
              </>
            )}
          </Form>
        ) : (
          <Form onSubmit={onSubmit} validateOn="onSubmit">
            {({ register, errors }) => (
              <>
                <FieldSet>
                  <Field
                    label={t('service-account-create-page.name.label', 'Display name')}
                    required
                    invalid={!!errors.name}
                    error={
                      errors.name
                        ? t('service-account-create-page.name.required-error', 'Display name is required')
                        : undefined
                    }
                  >
                    <Input id="display-name-input" {...register('name', { required: true })} autoFocus />
                  </Field>
                  <Field label={t('service-account-create-page.role.label', 'Role')}>
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
                      <OrgRolePicker
                        aria-label={t('service-account-create-page.role.label', 'Role')}
                        value={serviceAccount.role}
                        onChange={onRoleChange}
                      />
                    )}
                  </Field>
                </FieldSet>
                <Button type="submit">
                  <Trans i18nKey="service-account-create-page.create.button">Create</Trans>
                </Button>
              </>
            )}
          </Form>
        )}
      </Page.Contents>
    </Page>
  );
};

export default ServiceAccountCreatePage;
