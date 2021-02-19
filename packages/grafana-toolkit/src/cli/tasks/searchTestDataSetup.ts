import axios from 'axios';
import { Task, TaskRunner } from './task';

interface SearchTestDataSetupOptions {
  count: number;
}

const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  auth: {
    username: 'admin',
    password: 'admin2',
  },
});

export async function getUser(user: any): Promise<any> {
  console.log('Creating user ' + user.name);
  const search = await client.get('/users/search', {
    params: { query: user.login },
  });

  if (search.data.totalCount === 1) {
    user.id = search.data.users[0].id;
    return user;
  }

  const rsp = await client.post('/admin/users', user);
  user.id = rsp.data.id;
  return user;
}

export async function getTeam(team: any): Promise<any> {
  // delete if exists
  const teams = await client.get('/teams/search');
  for (const existing of teams.data.teams) {
    if (existing.name === team.name) {
      console.log('Team exists, deleting');
      await client.delete('/teams/' + existing.id);
    }
  }

  console.log('Creating team ' + team.name);
  const teamRsp = await client.post(`/teams`, team);
  team.id = teamRsp.data.teamId;
  return team;
}

export async function addToTeam(team: any, user: any): Promise<any> {
  console.log(`Adding user ${user.name} to team ${team.name}`);
  await client.post(`/teams/${team.id}/members`, { userId: user.id });
}

export async function setDashboardAcl(dashboardId: any, aclList: any) {
  console.log('Setting Dashboard ACL ' + dashboardId);
  await client.post(`/dashboards/id/${dashboardId}/permissions`, { items: aclList });
}

const searchTestDataSetupRunnner: TaskRunner<SearchTestDataSetupOptions> = async ({ count }) => {
  const user1 = await getUser({
    name: 'searchTestUser1',
    email: 'searchTestUser@team.com',
    login: 'searchTestUser1',
    password: '12345',
  });

  const team1 = await getTeam({ name: 'searchTestTeam1', email: 'searchtestdata@team.com' });
  addToTeam(team1, user1);

  // create or update folder
  const folder: any = {
    uid: 'search-test-data',
    title: 'Search test data folder',
    version: 1,
  };

  try {
    await client.delete(`/folders/${folder.uid}`);
  } catch (err) {}

  console.log('Creating folder');

  const rsp = await client.post(`/folders`, folder);
  folder.id = rsp.data.id;
  folder.url = rsp.data.url;

  await setDashboardAcl(folder.id, []);

  console.log('Creating dashboards');

  const dashboards: any = [];

  for (let i = 0; i < count; i++) {
    const dashboard: any = {
      uid: 'search-test-dash-' + i.toString().padStart(5, '0'),
      title: 'Search test dash ' + i.toString().padStart(5, '0'),
    };

    const rsp = await client.post(`/dashboards/db`, {
      dashboard: dashboard,
      folderId: folder.id,
      overwrite: true,
    });

    dashboard.id = rsp.data.id;
    dashboard.url = rsp.data.url;

    console.log('Created dashboard ' + dashboard.title);
    dashboards.push(dashboard);
    await setDashboardAcl(dashboard.id, [{ userId: 0, teamId: team1.id, permission: 4 }]);
  }
};

export const searchTestDataSetupTask = new Task<SearchTestDataSetupOptions>(
  'Search test data setup',
  searchTestDataSetupRunnner
);
