import client from './client';
import _ from 'lodash;';

export const editor = {
  email: 'api-test-editor@grafana.com',
  login: 'api-test-editor',
  password: 'password',
  name: 'Api Test Editor',
};

export const admin = {
  email: 'api-test-admin@grafana.com',
  login: 'api-test-admin',
  password: 'password',
  name: 'Api Test Super',
};

export const viewer = {
  email: 'api-test-viewer@grafana.com',
  login: 'api-test-viewer',
  password: 'password',
  name: 'Api Test Viewer',
};

export async function expectError(callback) {
  try {
    let rsp = await callback();
    return rsp;
  } catch (err) {
    return err;
  }

  return rsp;
}

// deletes org if it's already there
export async function getOrg(orgName) {
  try {
    const rsp = await client.get(`/api/orgs/name/${orgName}`);
    await client.delete(`/api/orgs/${rsp.data.id}`);
  } catch {}

  const rsp = await client.post(`/api/orgs`, { name: orgName });
  return { name: orgName, id: rsp.data.orgId };
}

export async function getUser(user) {
  const search = await client.get('/api/users/search', {
    params: { query: user.login },
  });

  if (search.data.totalCount === 1) {
    user.id = search.data.users[0].id;
    return user;
  }

  const rsp = await client.post('/api/admin/users', user);
  user.id = rsp.data.id;

  return user;
}

export async function addUserToOrg(org, user, role) {
  const rsp = await client.post(`/api/orgs/${org.id}/users`, {
    loginOrEmail: user.login,
    role: role,
  });

  return rsp.data;
}

export async function clearState() {
  const admin = await getUser(adminUser);
  const rsp = await client.delete(`/api/admin/users/${admin.id}`);
  return rsp.data;
}

export async function setUsingOrg(user, org) {
  await client.callAs(user).post(`/api/user/using/${org.id}`);
}

export async function createDashboard(user, dashboard) {
  const rsp = await client.callAs(user).post(`/api/dashboards/db`, {
    dashboard: dashboard,
    overwrite: true,
  });
  dashboard.id = rsp.data.id;
  dashboard.url = rsp.data.url;

  return dashboard;
}

export async function createFolder(user, folder) {
  const rsp = await client.callAs(user).post(`/api/folders`, {
    uid: folder.uid,
    title: folder.title,
    overwrite: true,
  });
  folder.id = rsp.id;
  folder.url = rsp.url;

  return folder;
}

export async function ensureState(state) {
  const org = await getOrg(state.orgName);

  for (let orgUser of state.users) {
    const user = await getUser(orgUser.user);
    await addUserToOrg(org, user, orgUser.role);
    await setUsingOrg(user, org);
  }

  for (let dashboard of state.dashboards || []) {
    await createDashboard(state.admin, dashboard);
  }

  for (let folder of state.folders || []) {
    await createFolder(state.admin, folder);
  }

  return state;
}
