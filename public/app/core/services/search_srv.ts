import _ from 'lodash';
import coreModule from 'app/core/core_module';
import impressionSrv from 'app/core/services/impression_srv';
import store from 'app/core/store';
import { contextSrv } from 'app/core/services/context_srv';

export class SearchSrv {
  recentIsOpen: boolean;
  starredIsOpen: boolean;

  /** @ngInject */
  constructor(private backendSrv, private $q) {
    this.recentIsOpen = store.getBool('search.sections.recent', true);
    this.starredIsOpen = store.getBool('search.sections.starred', true);
  }

  private getRecentDashboards(sections) {
    return this.queryForRecentDashboards().then(result => {
      if (result.length > 0) {
        sections['recent'] = {
          title: 'Recent',
          icon: 'fa fa-clock-o',
          score: -1,
          removable: true,
          expanded: this.recentIsOpen,
          toggle: this.toggleRecent.bind(this),
          items: result,
        };
      }
    });
  }

  private queryForRecentDashboards() {
    var dashIds = _.take(impressionSrv.getDashboardOpened(), 5);
    if (dashIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.backendSrv.search({ dashboardIds: dashIds }).then(result => {
      return dashIds
        .map(orderId => {
          return _.find(result, { id: orderId });
        })
        .filter(hit => hit && !hit.isStarred);
    });
  }

  private toggleRecent(section) {
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

  private toggleStarred(section) {
    this.starredIsOpen = section.expanded = !section.expanded;
    store.set('search.sections.starred', this.starredIsOpen);
    return Promise.resolve(section);
  }

  private getStarred(sections) {
    if (!contextSrv.isSignedIn) {
      return Promise.resolve();
    }

    return this.backendSrv.search({ starred: true, limit: 5 }).then(result => {
      if (result.length > 0) {
        sections['starred'] = {
          title: 'Starred',
          icon: 'fa fa-star-o',
          score: -2,
          expanded: this.starredIsOpen,
          toggle: this.toggleStarred.bind(this),
          items: result,
        };
      }
    });
  }

  search(options) {
    let sections: any = {};
    let promises = [];
    let query = _.clone(options);
    let hasFilters =
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
      this.backendSrv.search(query).then(results => {
        return this.handleSearchResult(sections, results);
      })
    );

    return this.$q.all(promises).then(() => {
      return _.sortBy(_.values(sections), 'score');
    });
  }

  private handleSearchResult(sections, results) {
    if (results.length === 0) {
      return sections;
    }

    // create folder index
    for (let hit of results) {
      if (hit.type === 'dash-folder') {
        sections[hit.id] = {
          id: hit.id,
          uid: hit.uid,
          title: hit.title,
          expanded: false,
          items: [],
          toggle: this.toggleFolder.bind(this),
          url: hit.url,
          icon: 'fa fa-folder',
          score: _.keys(sections).length,
        };
      }
    }

    for (let hit of results) {
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
            icon: 'fa fa-folder-open',
            toggle: this.toggleFolder.bind(this),
            score: _.keys(sections).length,
          };
        } else {
          section = {
            id: 0,
            title: 'General',
            items: [],
            icon: 'fa fa-folder-open',
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

  private toggleFolder(section) {
    section.expanded = !section.expanded;
    section.icon = section.expanded ? 'fa fa-folder-open' : 'fa fa-folder';

    if (section.items.length) {
      return Promise.resolve(section);
    }

    let query = {
      folderIds: [section.id],
    };

    return this.backendSrv.search(query).then(results => {
      section.items = results;
      return Promise.resolve(section);
    });
  }

  getDashboardTags() {
    return this.backendSrv.get('/api/dashboards/tags');
  }
}

coreModule.service('searchSrv', SearchSrv);
