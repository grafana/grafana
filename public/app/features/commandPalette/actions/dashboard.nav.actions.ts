import { Action } from 'kbar';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { getGrafanaSearcher } from 'app/features/search/service';

async function getDashboardNav(parentId: string): Promise<Action[]> {
  const data = await getGrafanaSearcher().search({
    kind: ['dashboard'],
    query: '*',
    limit: 500,
  });

  const goToDashboardActions: Action[] = data.view.map((item) => ({
    parent: parentId,
    id: `go/dashboard/${item.url}`,
    name: `${item.name}`,
    perform: () => {
      locationService.push(locationUtil.stripBaseFromUrl(item.url));
    },
  }));

  return goToDashboardActions;
}

export default async (parentId: string) => {
  const dashboardNav = await getDashboardNav(parentId);
  return dashboardNav;
};
