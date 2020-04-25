import _ from 'lodash';

import impressionSrv from 'app/core/services/impression_srv';
import store from 'app/core/store';
import { contextSrv } from 'app/core/services/context_srv';
import { hasFilters } from 'app/features/search/utils';
import { DashboardSection, DashboardSearchItemType, DashboardSearchHit, SearchLayout } from 'app/features/search/types';
import { backendSrv } from './backend_srv';

export class SearchSrv {
  recentIsOpen: boolean;
  starredIsOpen: boolean;

  constructor() {
    this.recentIsOpen = store.getBool('search.sections.recent', true);
    this.starredIsOpen = store.getBool('search.sections.starred', true);
  }

  private getRecentDashboards(sections: DashboardSection[] | any) {
    return this.queryForRecentDashboards().then((result: any[]) => {
      if (result.length > 0) {
        sections['recent'] = {
          title: 'Recent',
          icon: 'clock-nine',
          score: -1,
          expanded: this.recentIsOpen,
          items: result,
          type: DashboardSearchItemType.DashFolder,
        };
      }
    });
  }

  private queryForRecentDashboards(): Promise<DashboardSearchHit[]> {
    const dashIds: number[] = _.take(impressionSrv.getDashboardOpened(), 30);
    if (dashIds.length === 0) {
      return Promise.resolve([]);
    }

    return backendSrv.search({ dashboardIds: dashIds }).then(result => {
      return dashIds
        .map(orderId => result.find(result => result.id === orderId))
        .filter(hit => hit && !hit.isStarred) as DashboardSearchHit[];
    });
  }

  private getStarred() {
    if (!contextSrv.isSignedIn) {
      return Promise.resolve();
    }

    return backendSrv.search({ starred: true, limit: 30 }).then(result => {
      if (!result?.length) {
        return Promise.resolve({});
      }
      return {
        title: 'Starred',
        icon: 'star',
        score: -2,
        expanded: this.starredIsOpen,
        items: result,
        type: DashboardSearchItemType.DashFolder,
      };
    });
  }

  search(options: any) {
    const sections: any = {};
    const promises = [];
    const query = _.clone(options);
    const filters = hasFilters(options) || query.folderIds?.length > 0;

    if (!options.skipRecent && !filters) {
      promises.push(this.getRecentDashboards(sections));
    }

    if (!options.skipStarred && !filters) {
      promises.push(this.getStarred());
    }

    query.folderIds = query.folderIds || [];
    if (!filters) {
      query.folderIds = [0];
    }

    promises.push(
      backendSrv.search(query).then(results => {
        return this.handleSearchResult(results, options.layout === SearchLayout.List);
      })
    );

    return Promise.all(promises).then(results => {
      return results.flat();
    });
  }

  private handleSearchResult(results: DashboardSearchHit[], flatList = false): any {
    if (results.length === 0) {
      return [];
    }
    const dbs = results.filter(result => result.type === DashboardSearchItemType.DashDB);

    if (flatList) {
      return dbs;
    }

    const folders = results
      .filter(result => result.type === DashboardSearchItemType.DashFolder)
      .map(result => ({ ...result, expanded: false, items: [], icon: 'folder' }));

    const sections = folders.map(folder => ({ ...folder, items: dbs.filter(db => db.folderId === folder.id) }));

    const noFolderDbs = results.filter(result => !result.folderId && result.type === DashboardSearchItemType.DashDB);
    if (noFolderDbs.length) {
      return [
        ...sections,
        {
          id: 0,
          title: 'General',
          items: noFolderDbs,
          icon: 'folder-open',
          type: DashboardSearchItemType.DashFolder,
          expanded: true,
        },
      ];
    }

    return sections;
  }

  getDashboardTags() {
    return backendSrv.get('/api/dashboards/tags');
  }

  getSortOptions() {
    return backendSrv.get('/api/search/sorting');
  }
}
