import { clone, keys, sortBy, take, values } from 'lodash';

import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import store from 'app/core/store';
import { SECTION_STORAGE_KEY } from 'app/features/search/constants';
import {
  DashboardSection,
  DashboardSearchItemType,
  DashboardSearchItem,
  SearchLayout,
} from 'app/features/search/types';
import { hasFilters } from 'app/features/search/utils';

import { backendSrv } from './backend_srv';

interface Sections {
  [key: string]: Partial<DashboardSection>;
}

/** @deprecated */
export class SearchSrv {
  private getRecentDashboards(sections: DashboardSection[] | any) {
    return this.queryForRecentDashboards().then((result: any[]) => {
      if (result.length > 0) {
        sections['recent'] = {
          title: 'Recent',
          icon: 'clock-nine',
          score: -1,
          expanded: store.getBool(`${SECTION_STORAGE_KEY}.recent`, true),
          items: result,
          type: DashboardSearchItemType.DashFolder,
        };
      }
    });
  }

  private queryForRecentDashboards(): Promise<DashboardSearchItem[]> {
    return new Promise((resolve) => {
      impressionSrv.getDashboardOpened().then((uids) => {
        const dashUIDs: string[] = take(uids, 30);
        if (dashUIDs.length === 0) {
          return resolve([]);
        }

        backendSrv.search({ dashboardUIDs: dashUIDs }).then((result) => {
          return resolve(
            dashUIDs
              .map((orderId) => result.find((result) => result.uid === orderId))
              .filter((hit) => hit && !hit.isStarred) as DashboardSearchItem[]
          );
        });
      });
    });
  }

  private getStarred(sections: DashboardSection): Promise<any> {
    if (!contextSrv.isSignedIn) {
      return Promise.resolve();
    }

    return backendSrv.search({ starred: true, limit: 30 }).then((result) => {
      if (result.length > 0) {
        (sections as any)['starred'] = {
          title: 'Starred',
          icon: 'star',
          score: -2,
          expanded: store.getBool(`${SECTION_STORAGE_KEY}.starred`, true),
          items: result,
          type: DashboardSearchItemType.DashFolder,
        };
      }
    });
  }

  search(options: any) {
    const sections: any = {};
    const promises = [];
    const query = clone(options);
    const filters = hasFilters(options) || query.folderIds?.length > 0;

    query.folderIds = query.folderIds || [];

    if (query.layout === SearchLayout.List) {
      return backendSrv
        .search({ ...query, type: DashboardSearchItemType.DashDB })
        .then((results) => (results.length ? [{ title: '', items: results }] : []));
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
      backendSrv.search(query).then((results) => {
        return this.handleSearchResult(sections, results);
      })
    );

    return Promise.all(promises).then(() => {
      return sortBy(values(sections), 'score');
    });
  }

  private handleSearchResult(sections: Sections, results: DashboardSearchItem[]): any {
    if (results.length === 0) {
      return sections;
    }

    // create folder index
    for (const hit of results) {
      if (hit.type === 'dash-folder') {
        sections[hit.uid!] = {
          uid: hit.uid,
          title: hit.title,
          expanded: false,
          items: [],
          url: hit.url,
          icon: 'folder',
          score: keys(sections).length,
          type: hit.type,
        };
      }
    }

    for (const hit of results) {
      if (hit.type === 'dash-folder') {
        continue;
      }

      let section = sections[hit.folderUid || 0];
      if (!section) {
        if (hit.folderUid) {
          section = {
            uid: hit.folderUid,
            title: hit.folderTitle,
            url: hit.folderUrl,
            items: [],
            icon: 'folder-open',
            score: keys(sections).length,
            type: DashboardSearchItemType.DashFolder,
          };
        } else {
          section = {
            uid: '',
            title: 'General',
            items: [],
            icon: 'folder-open',
            score: keys(sections).length,
            type: DashboardSearchItemType.DashFolder,
          };
        }
        // add section
        sections[hit.folderUid || 0] = section;
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
