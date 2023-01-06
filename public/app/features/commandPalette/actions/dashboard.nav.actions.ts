import { Action } from 'kbar';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import impressionSrv from 'app/core/services/impression_srv';
import { getGrafanaSearcher } from 'app/features/search/service';

const MAX_ITEMS = 100;

const SECTION_STARRED = {
  name: 'Starred dashboards',
  priority: 1,
};

const SECTION_RECENT = {
  name: 'Recently viewed dashboards',
  priority: 2,
};

const SECTION_SEARCH_RESULTS = {
  name: 'Dashboard search results',
  priority: 3,
};

async function getRecentDashboards() {
  const recentUids = (await impressionSrv.getDashboardOpened()).slice(0, MAX_ITEMS);
  const resultsDataFrame = await getGrafanaSearcher().search({
    kind: ['dashboard'],
    limit: MAX_ITEMS,
    uid: recentUids,
  });

  // Search results are alphabetical, so reorder them according to recently viewed
  const recentResults = resultsDataFrame.view.toArray();
  recentResults.sort((resultA, resultB) => {
    const orderA = recentUids.indexOf(resultA.uid);
    const orderB = recentUids.indexOf(resultB.uid);
    return orderA - orderB;
  });

  return recentResults;
}

async function getStarredDashboards() {
  const resultsDataFrame = await getGrafanaSearcher().starred({
    kind: ['dashboard'],
    limit: MAX_ITEMS,
    starred: true,
  });

  return resultsDataFrame.view.toArray();
}

async function getInitialDashboards(parentId: string): Promise<Action[]> {
  const [recentResults, starredResults] = await Promise.all([getRecentDashboards(), getStarredDashboards()]);

  const recentDashboardActions: Action[] = recentResults.map((item) => {
    const { url, name } = item; // items are backed by DataFrameView, so must hold the url in a closure
    return {
      parent: parentId,
      id: `go/dashboard/${url}`,
      name: `${name}`,
      section: SECTION_RECENT,
      perform: () => {
        locationService.push(locationUtil.stripBaseFromUrl(url));
      },
    };
  });

  const starredDashboardActions: Action[] = starredResults.map((item) => {
    const { url, name } = item; // items are backed by DataFrameView, so must hold the url in a closure
    return {
      parent: parentId,
      id: `go/dashboard/${url}`,
      name: `${name}`,
      section: SECTION_STARRED,
      perform: () => {
        locationService.push(locationUtil.stripBaseFromUrl(url));
      },
    };
  });

  return [...recentDashboardActions, ...starredDashboardActions];
}

export async function getDashboardSearchResultActions(parentId: string, searchQuery: string): Promise<Action[]> {
  if (searchQuery.length === 0) {
    return getInitialDashboards(parentId);
  }

  const data = await getGrafanaSearcher().search({
    kind: ['dashboard'],
    query: searchQuery,
    limit: 100,
  });

  const goToDashboardActions: Action[] = data.view.map((item) => {
    const { url, name } = item; // items are backed by DataFrameView, so must hold the url in a closure
    return {
      parent: parentId,
      id: `go/dashboard/${url}`,
      name: `${name}`,
      section: SECTION_SEARCH_RESULTS,
      perform: () => {
        locationService.push(locationUtil.stripBaseFromUrl(url));
      },
    };
  });

  return goToDashboardActions;
}

// export default async (parentId: string) => {
//   const dashboardNav = await getDashboardNav(parentId);
//   return dashboardNav;
// };
