import { Action, locationService, getBackendSrv } from '@grafana/runtime';

async function getDashboardNav(): Promise<Action[]> {
  const data: Array<{ type: string; title: string; url: string }> = await getBackendSrv().get('/api/search');

  const parentAction: Action = {
    id: 'go/dashboard',
    name: 'Go to dashboard',
  };

  const goToDashboardActions: Action[] = data
    .filter((item) => item.type === 'dash-db')
    .map((item) => ({
      parent: parentAction.id,
      id: `go/dashboard/${item.url}`,
      name: `Go to dashboard ${item.title}`,
      perform: () => {
        locationService.push(item.url);
      },
    }));

  return [parentAction, ...goToDashboardActions];
}

export default async () => {
  const dashboardNav = await getDashboardNav();
  return dashboardNav;
};
