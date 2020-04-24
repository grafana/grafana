import React, { FC, useState, useEffect } from 'react';
import Page from 'app/core/components/Page/Page';
import { useSelector } from 'react-redux';
import { StoreState, OrgUser } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import UsersTable from '../users/UsersTable';
import { useAsyncFn } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { UrlQueryValue } from '@grafana/data';
import { Form, Field, Input, Button } from '@grafana/ui';

const getOrg = async (orgId: UrlQueryValue) => {
  return await getBackendSrv().get('/api/orgs/' + orgId);
};

const getOrgUsers = async (orgId: UrlQueryValue) => {
  return await getBackendSrv().get('/api/orgs/' + orgId + '/users');
};

const updateOrgUserRole = async (role: OrgRole, orgUser: OrgUser, orgId: UrlQueryValue) => {
  await getBackendSrv().patch('/api/orgs/' + orgId + '/users/' + orgUser.userId, orgUser);
};

export const AdminEditOrgPage: FC = () => {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const navModel = getNavModel(navIndex, 'global-orgs');

  const orgId = useSelector((state: StoreState) => state.location.routeParams.id);

  const [org, setOrg] = useState();
  const [users, setUsers] = useState();

  const [orgState, fetchOrg] = useAsyncFn(() => getOrg(orgId), []);
  const [usersState, fetchOrgUsers] = useAsyncFn(() => getOrgUsers(orgId), []);

  useEffect(() => {
    setOrg(fetchOrg());
    setUsers(fetchOrgUsers());
  }, []);

  const updateOrgName = async (name: string) => {
    setOrg({ ...org, name });
    return await getBackendSrv().put('/api/orgs/' + orgId, org);
  };
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <>
          <Form onSubmit={async values => await updateOrgName(values.orgName)}>
            {({ register, errors }) => (
              <>
                <Field label="Name" invalid={!!errors.orgName} error="Name is required">
                  <Input name="orgName" ref={register({ required: true })} />
                </Field>
                <Button>Update</Button>
              </>
            )}
          </Form>

          {usersState.loading && <p>Fetching users...</p>}
          {usersState.error && <p>{usersState.error}</p>}
          {users && <UsersTable users={org.users} onRoleChange={() => {}} />}
        </>
      </Page.Contents>
    </Page>
  );
};
