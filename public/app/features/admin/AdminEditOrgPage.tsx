import React, { FC, useState, useEffect } from 'react';
import Page from 'app/core/components/Page/Page';
import { useSelector } from 'react-redux';
import { StoreState, OrgUser, AccessControlAction } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import UsersTable from '../users/UsersTable';
import { useAsyncFn } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { UrlQueryValue } from '@grafana/data';
import { Form, Field, Input, Button, Legend, Alert } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { contextSrv } from 'app/core/core';

interface OrgNameDTO {
  orgName: string;
}

// TODO if I reached this page this is because I had the ability to read all orgs, do I need to protect this?
const getOrg = async (orgId: UrlQueryValue) => {
  return await getBackendSrv().get('/api/orgs/' + orgId);
};

const getOrgUsers = async (orgId: UrlQueryValue) => {
  if (contextSrv.hasPermission(AccessControlAction.OrgUsersRead)) {
    return await getBackendSrv().get('/api/orgs/' + orgId + '/users');
  }
  return [];
};

const updateOrgUserRole = async (orgUser: OrgUser, orgId: UrlQueryValue) => {
  if (contextSrv.hasPermission(AccessControlAction.OrgUsersRoleUpdate)) {
    await getBackendSrv().patch('/api/orgs/' + orgId + '/users/' + orgUser.userId, orgUser);
  }
};

const removeOrgUser = async (orgUser: OrgUser, orgId: UrlQueryValue) => {
  if (contextSrv.hasPermission(AccessControlAction.OrgUsersRemove)) {
    return await getBackendSrv().delete('/api/orgs/' + orgId + '/users/' + orgUser.userId);
  }
};

interface Props extends GrafanaRouteComponentProps<{ id: string }> {}

export const AdminEditOrgPage: FC<Props> = ({ match }) => {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const navModel = getNavModel(navIndex, 'global-orgs');
  const orgId = parseInt(match.params.id, 10);
  const canEditOrg = contextSrv.hasPermission(AccessControlAction.OrgsWrite);
  const canListUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);

  const [users, setUsers] = useState<OrgUser[]>([]);

  const [orgState, fetchOrg] = useAsyncFn(() => getOrg(orgId), []);
  const [, fetchOrgUsers] = useAsyncFn(() => getOrgUsers(orgId), []);

  useEffect(() => {
    fetchOrg();
    fetchOrgUsers().then((res) => setUsers(res));
  }, [fetchOrg, fetchOrgUsers]);

  const updateOrgName = async (name: string) => {
    return await getBackendSrv().put('/api/orgs/' + orgId, { ...orgState.value, name });
  };

  // TODO did this to be consistent with data sources access notifications, but do we want to have something standardized and centralized?
  const renderMissingUserListRightsMessage = () => {
    return (
      <Alert severity="info" title="Missing rights">
        You are not allowed to see users in this organization. Please contact your server admin to update this
        organization.
      </Alert>
    );
  };

  // TODO should I render a mising right message when you are not allowed to edit an org?

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <>
          <Legend>Edit organization</Legend>
          {orgState.value && (
            <Form
              defaultValues={{ orgName: orgState.value.name }}
              onSubmit={async (values: OrgNameDTO) => await updateOrgName(values.orgName)}
            >
              {({ register, errors }) => (
                <>
                  <Field label="Name" invalid={!!errors.orgName} error="Name is required" disabled={!canEditOrg}>
                    <Input {...register('orgName', { required: true })} id="org-name-input" />
                  </Field>
                  <Button disabled={!canEditOrg}>Update</Button>
                </>
              )}
            </Form>
          )}

          <div
            className={css`
              margin-top: 20px;
            `}
          >
            <Legend>Organization users</Legend>
            {!canListUsers && renderMissingUserListRightsMessage()}
            {canListUsers && !!users.length && (
              <UsersTable
                users={users}
                onRoleChange={(role, orgUser) => {
                  updateOrgUserRole({ ...orgUser, role }, orgId);
                  setUsers(
                    users.map((user) => {
                      if (orgUser.userId === user.userId) {
                        return { ...orgUser, role };
                      }
                      return user;
                    })
                  );
                  fetchOrgUsers();
                }}
                onRemoveUser={(orgUser) => {
                  removeOrgUser(orgUser, orgId);
                  setUsers(users.filter((user) => orgUser.userId !== user.userId));
                  fetchOrgUsers();
                }}
              />
            )}
          </div>
        </>
      </Page.Contents>
    </Page>
  );
};

export default AdminEditOrgPage;
