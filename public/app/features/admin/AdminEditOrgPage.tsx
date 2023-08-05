import React, { useState, useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { NavModelItem, UrlQueryValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Form, Field, Input, Button, Legend, Alert, VerticalGroup, HorizontalGroup, Pagination } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { OrgUser, AccessControlAction, OrgRole } from 'app/types';

import { UsersTable } from '../users/UsersTable';

const perPage = 30;

interface OrgNameDTO {
  orgName: string;
}

const getOrg = async (orgId: UrlQueryValue) => {
  return await getBackendSrv().get(`/api/orgs/${orgId}`);
};

const getOrgUsers = async (orgId: UrlQueryValue, page: number) => {
  if (contextSrv.hasPermission(AccessControlAction.OrgUsersRead)) {
    return getBackendSrv().get(`/api/orgs/${orgId}/users/search`, accessControlQueryParam({ perpage: perPage, page }));
  }
  return { orgUsers: [] };
};

const updateOrgUserRole = (orgUser: OrgUser, orgId: UrlQueryValue) => {
  return getBackendSrv().patch(`/api/orgs/${orgId}/users/${orgUser.userId}`, orgUser);
};

const removeOrgUser = (orgUser: OrgUser, orgId: UrlQueryValue) => {
  return getBackendSrv().delete(`/api/orgs/${orgId}/users/${orgUser.userId}`);
};

interface Props extends GrafanaRouteComponentProps<{ id: string }> {}

const AdminEditOrgPage = ({ match }: Props) => {
  const orgId = parseInt(match.params.id, 10);
  const canWriteOrg = contextSrv.hasPermission(AccessControlAction.OrgsWrite);
  const canReadUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [orgState, fetchOrg] = useAsyncFn(() => getOrg(orgId), []);
  const [, fetchOrgUsers] = useAsyncFn(async (page) => {
    const result = await getOrgUsers(orgId, page);
    const totalPages = result?.perPage !== 0 ? Math.ceil(result.totalCount / result.perPage) : 0;
    setTotalPages(totalPages);
    setUsers(result.orgUsers);
    return result.orgUsers;
  }, []);

  useEffect(() => {
    fetchOrg();
    fetchOrgUsers(page);
  }, [fetchOrg, fetchOrgUsers, page]);

  const updateOrgName = async (name: string) => {
    return await getBackendSrv().put(`/api/orgs/${orgId}`, { ...orgState.value, name });
  };

  const renderMissingPermissionMessage = () => (
    <Alert severity="info" title="Access denied">
      You do not have permission to see users in this organization. To update this organization, contact your server
      administrator.
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
          <Legend>Edit organization</Legend>
          {orgState.value && (
            <Form
              defaultValues={{ orgName: orgState.value.name }}
              onSubmit={(values: OrgNameDTO) => updateOrgName(values.orgName)}
            >
              {({ register, errors }) => (
                <>
                  <Field label="Name" invalid={!!errors.orgName} error="Name is required" disabled={!canWriteOrg}>
                    <Input {...register('orgName', { required: true })} id="org-name-input" />
                  </Field>
                  <Button type="submit" disabled={!canWriteOrg}>
                    Update
                  </Button>
                </>
              )}
            </Form>
          )}

          <div style={{ marginTop: '20px' }}>
            <Legend>Organization users</Legend>
            {!canReadUsers && renderMissingPermissionMessage()}
            {canReadUsers && !!users.length && (
              <VerticalGroup spacing="md">
                <UsersTable users={users} orgId={orgId} onRoleChange={onRoleChange} onRemoveUser={onRemoveUser} />
                <HorizontalGroup justify="flex-end">
                  <Pagination
                    onNavigate={onPageChange}
                    currentPage={page}
                    numberOfPages={totalPages}
                    hideWhenSinglePage={true}
                  />
                </HorizontalGroup>
              </VerticalGroup>
            )}
          </div>
        </>
      </Page.Contents>
    </Page>
  );
};

export default AdminEditOrgPage;
