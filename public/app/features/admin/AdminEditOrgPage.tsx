import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom-v5-compat';
import { useAsyncFn } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { Field, Input, Button, Legend, Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { Trans } from 'app/core/internationalization';
import { OrgUser, AccessControlAction, OrgRole } from 'app/types';

import { OrgUsersTable } from './Users/OrgUsersTable';
import { getOrg, getOrgUsers, getUsersRoles, removeOrgUser, updateOrgName, updateOrgUserRole } from './api';

interface OrgNameDTO {
  orgName: string;
}

const AdminEditOrgPage = () => {
  const { id = '' } = useParams();
  const orgId = parseInt(id, 10);
  const canWriteOrg = contextSrv.hasPermission(AccessControlAction.OrgsWrite);
  const canReadUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [orgState, fetchOrg] = useAsyncFn(() => getOrg(orgId), []);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<OrgNameDTO>();
  const [, fetchOrgUsers] = useAsyncFn(async (page) => {
    const result = await getOrgUsers(orgId, page);

    if (contextSrv.licensedAccessControlEnabled()) {
      await getUsersRoles(orgId, result.orgUsers);
    }

    const totalPages = result?.perPage !== 0 ? Math.ceil(result.totalCount / result.perPage) : 0;
    setTotalPages(totalPages);
    setUsers(result.orgUsers);
    return result.orgUsers;
  }, []);

  useEffect(() => {
    fetchOrg();
    fetchOrgUsers(page);
  }, [fetchOrg, fetchOrgUsers, page]);

  const onUpdateOrgName = async ({ orgName }: OrgNameDTO) => {
    await updateOrgName(orgName, orgId);
  };

  const renderMissingPermissionMessage = () => (
    <Alert severity="info" title="Access denied">
      <Trans i18nKey="admin.edit-org.access-denied">
        You do not have permission to see users in this organization. To update this organization, contact your server
        administrator.
      </Trans>
    </Alert>
  );

  const onPageChange = (toPage: number) => {
    setPage(toPage);
  };

  const onRemoveUser = async (orgUser: OrgUser) => {
    await removeOrgUser(orgUser, orgId);
    fetchOrgUsers(page);
  };

  const onRoleChange = async (role: OrgRole, orgUser: OrgUser) => {
    await updateOrgUserRole({ ...orgUser, role }, orgId);
    fetchOrgUsers(page);
  };

  const pageNav: NavModelItem = {
    text: orgState?.value?.name ?? '',
    icon: 'shield',
    subTitle: 'Manage settings and user roles for an organization.',
  };

  return (
    <Page navId="global-orgs" pageNav={pageNav} subTitle="Manage settings for this specific org.">
      <Page.Contents>
        <>
          <Legend>
            <Trans i18nKey="admin.edit-org.heading">Edit Organization</Trans>
          </Legend>
          {orgState.value && (
            <form onSubmit={handleSubmit(onUpdateOrgName)} style={{ maxWidth: '600px' }}>
              <Field label="Name" invalid={!!errors.orgName} error="Name is required" disabled={!canWriteOrg}>
                <Input
                  {...register('orgName', { required: true })}
                  id="org-name-input"
                  defaultValue={orgState.value.name}
                />
              </Field>
              <Button type="submit" disabled={!canWriteOrg}>
                <Trans i18nKey="admin.edit-org.update-button">Update</Trans>
              </Button>
            </form>
          )}

          <div style={{ marginTop: '20px' }}>
            <Legend>
              <Trans i18nKey="admin.edit-org.users-heading">Organization users</Trans>
            </Legend>
            {!canReadUsers && renderMissingPermissionMessage()}
            {canReadUsers && !!users.length && (
              <OrgUsersTable
                users={users}
                orgId={orgId}
                onRoleChange={onRoleChange}
                onRemoveUser={onRemoveUser}
                changePage={onPageChange}
                page={page}
                totalPages={totalPages}
              />
            )}
          </div>
        </>
      </Page.Contents>
    </Page>
  );
};

export default AdminEditOrgPage;
