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

  const goToDashboardActions: Action[] = data.view.map((item) => {
    const { url, name } = item; // items are backed by DataFrameView, so must hold the url in a closure
    return {
      parent: parentId,
      id: `go/dashboard/${url}`,
      name: `${name}`,
      perform: () => {
        locationService.push(locationUtil.stripBaseFromUrl(url));
      },
    };
  });

  return goToDashboardActions;
}

export default async (parentId: string) => {
  const dashboardNav = await getDashboardNav(parentId);
  return dashboardNav;
};
