import _ from 'lodash';

import impressionSrv from 'app/core/services/impression_srv';
import store from 'app/core/store';
import { contextSrv } from 'app/core/services/context_srv';
import { hasFilters } from 'app/features/search/utils';
import { DashboardSection, DashboardSearchItemType, DashboardSearchHit, SearchLayout } from 'app/features/search/types';
import { backendSrv } from './backend_srv';

interface Sections {
  [key: string]: Partial<DashboardSection>;
}

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

  private getStarred(sections: DashboardSection): Promise<any> {
    if (!contextSrv.isSignedIn) {
      return Promise.resolve();
    }

    return backendSrv.search({ starred: true, limit: 30 }).then(result => {
      if (result.length > 0) {
        (sections as any)['starred'] = {
          title: 'Starred',
          icon: 'star',
          score: -2,
          expanded: this.starredIsOpen,
          items: result,
          type: DashboardSearchItemType.DashFolder,
        };
      }
    });
  }

  search(options: any) {
    const sections: any = {};
    const promises = [];
    const query = _.clone(options);
    const filters = hasFilters(options) || query.folderIds?.length > 0;

    query.folderIds = query.folderIds || [];

    if (query.layout === SearchLayout.List) {
      return backendSrv
        .search({ ...query, type: DashboardSearchItemType.DashDB })
        .then(results => [{ items: results }]);
    }

    if (!filters) {
      query.folderIds = [0];
    }

    if (!options.skipRecent && !filters) {
      promises.push(this.getRecentDashboards(sections));
    }

    if (!options.skipStarred && !filters) {
      promises.push(this.getStarred(sections));
    }

    promises.push(
      backendSrv.search(query).then(results => {
        return this.handleSearchResult(sections, results);
      })
    );

    return Promise.all(promises).then(() => {
      return _.sortBy(_.values(sections), 'score');
    });
  }

  private handleSearchResult(sections: Sections, results: DashboardSearchHit[]): any {
    if (results.length === 0) {
      return sections;
    }

    // create folder index
    for (const hit of results) {
      if (hit.type === 'dash-folder') {
        sections[hit.id] = {
          id: hit.id,
          uid: hit.uid,
          title: hit.title,
          expanded: false,
          items: [],
          url: hit.url,
          icon: 'folder',
          score: _.keys(sections).length,
          type: hit.type,
        };
      }
    }

    for (const hit of results) {
      if (hit.type === 'dash-folder') {
        continue;
      }

      let section = sections[hit.folderId || 0];
      if (!section) {
        if (hit.folderId) {
          section = {
            id: hit.folderId,
            uid: hit.folderUid,
            title: hit.folderTitle,
            url: hit.folderUrl,
            items: [],
            icon: 'folder-open',
            score: _.keys(sections).length,
            type: DashboardSearchItemType.DashFolder,
          };
        } else {
          section = {
            id: 0,
            title: 'General',
            items: [],
            icon: 'folder-open',
            score: _.keys(sections).length,
            type: DashboardSearchItemType.DashFolder,
          };
        }
        // add section
        sections[hit.folderId || 0] = section;
      }

      section.expanded = true;
      section.items && section.items.push(hit);
    }
  }

  getDashboardTags() {
    return backendSrv.get('/api/dashboards/tags');
  }

  getSortOptions() {
    return backendSrv.get('/api/search/sorting');
  }
}
