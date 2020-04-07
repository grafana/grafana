import _ from 'lodash';

import coreModule from 'app/core/core_module';
import impressionSrv from 'app/core/services/impression_srv';
import store from 'app/core/store';
import { contextSrv } from 'app/core/services/context_srv';
import { backendSrv } from './backend_srv';
import { Section } from '../components/manage_dashboards/manage_dashboards';
import { DashboardSearchHit } from 'app/types/search';

interface Sections {
  [key: string]: Partial<Section>;
}

export class SearchSrv {
  recentIsOpen: boolean;
  starredIsOpen: boolean;

  constructor() {
    this.recentIsOpen = store.getBool('search.sections.recent', true);
    this.starredIsOpen = store.getBool('search.sections.starred', true);
  }

  private getRecentDashboards(sections: Sections) {
    return this.queryForRecentDashboards().then((result: any[]) => {
      if (result.length > 0) {
        sections['recent'] = {
          title: 'Recent',
          icon: 'clock-o',
          score: -1,
          removable: true,
          expanded: this.recentIsOpen,
          toggle: this.toggleRecent.bind(this),
          items: result,
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
        .map(orderId => {
          return _.find(result, { id: orderId });
        })
        .filter(hit => hit && !hit.isStarred);
    });
  }

  private toggleRecent(section: Section) {
    this.recentIsOpen = section.expanded = !section.expanded;
    store.set('search.sections.recent', this.recentIsOpen);

    if (!section.expanded || section.items.length) {
      return Promise.resolve(section);
    }

    return this.queryForRecentDashboards().then(result => {
      section.items = result;
      return Promise.resolve(section);
    });
  }

  private toggleStarred(section: Section) {
    this.starredIsOpen = section.expanded = !section.expanded;
    store.set('search.sections.starred', this.starredIsOpen);
    return Promise.resolve(section);
  }

  private getStarred(sections: Sections) {
    if (!contextSrv.isSignedIn) {
      return Promise.resolve();
    }

    return backendSrv.search({ starred: true, limit: 30 }).then(result => {
      if (result.length > 0) {
        sections['starred'] = {
          title: 'Starred',
          icon: 'star-o',
          score: -2,
          expanded: this.starredIsOpen,
          toggle: this.toggleStarred.bind(this),
          items: result,
        };
      }
    });
  }

  search(options: any) {
    const sections: any = {};
    const promises = [];
    const query = _.clone(options);
    const hasFilters =
      options.query ||
      (options.tag && options.tag.length > 0) ||
      options.starred ||
      (options.folderIds && options.folderIds.length > 0);

    if (!options.skipRecent && !hasFilters) {
      promises.push(this.getRecentDashboards(sections));
    }

    if (!options.skipStarred && !hasFilters) {
      promises.push(this.getStarred(sections));
    }

    query.folderIds = query.folderIds || [];
    if (!hasFilters) {
      query.folderIds = [0];
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
          toggle: this.toggleFolder.bind(this),
          url: hit.url,
          icon: 'folder',
          score: _.keys(sections).length,
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
            toggle: this.toggleFolder.bind(this),
            score: _.keys(sections).length,
          };
        } else {
          section = {
            id: 0,
            title: 'General',
            items: [],
            icon: 'folder-open',
            toggle: this.toggleFolder.bind(this),
            score: _.keys(sections).length,
          };
        }
        // add section
        sections[hit.folderId || 0] = section;
      }

      section.expanded = true;
      section.items.push(hit);
    }
  }

  private toggleFolder(section: Section) {
    section.expanded = !section.expanded;
    section.icon = section.expanded ? 'folder-open' : 'folder';

    if (section.items.length) {
      return Promise.resolve(section);
    }

    const query = {
      folderIds: [section.id],
    };

    return backendSrv.search(query).then(results => {
      section.items = results;
      return Promise.resolve(section);
    });
  }

  getDashboardTags() {
    return backendSrv.get('/api/dashboards/tags');
  }
}

coreModule.service('searchSrv', SearchSrv);
