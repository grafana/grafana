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
          title: 'Recent Boards',
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
      return dashIds.map(orderId => {
        return this.transformToViewModel(_.find(result, { id: orderId }));
      }).filter(item => !item.isStarred);
    });
  }

  private toggleRecent(section) {
    this.recentIsOpen = section.expanded = !section.expanded;
    store.set('search.sections.recent', this.recentIsOpen);

    if (!section.expanded || section.items.length) {
      return;
    }

    return this.queryForRecentDashboards().then(result => {
      section.items = result;
    });
  }

  private toggleStarred(section) {
    this.starredIsOpen = section.expanded = !section.expanded;
    store.set('search.sections.starred', this.starredIsOpen);
  }

  private getStarred(sections) {
    if (!contextSrv.isSignedIn) {
      return Promise.resolve();
    }

    return this.backendSrv.search({starred: true, limit: 5}).then(result => {
      if (result.length > 0) {
        sections['starred'] = {
          title: 'Starred Boards',
          icon: 'fa fa-star-o',
          score: -2,
          expanded: this.starredIsOpen,
          toggle: this.toggleStarred.bind(this),
          items: this.transformToViewModel(result),
        };
      }
    });
  }

  private getDashboardsAndFolders(sections) {
    const rootFolderId = 0;

    let query = {
      folderIds: [rootFolderId],
    };

    return this.backendSrv.search(query).then(results => {
      for (let hit of results) {
        if (hit.type === 'dash-folder') {
          sections[hit.id] = {
            id: hit.id,
            title: hit.title,
            items: [],
            icon: 'fa fa-folder',
            score: _.keys(sections).length,
            uri: hit.uri,
            toggle: this.toggleFolder.bind(this),
          };
        }
      }

      sections[0] = {
        id: 0,
        title: 'Root',
        items: [],
        icon: 'fa fa-folder-open',
        score: _.keys(sections).length,
        expanded: true,
      };

      for (let hit of results) {
        if (hit.type === 'dash-folder') {
          continue;
        }
        let section = sections[hit.folderId || 0];
        if (section) {
          section.items.push(this.transformToViewModel(hit));
        } else {
          console.log('Error: dashboard returned from browse search but not folder', hit.id, hit.folderId);
        }
      }
    });
  }

  private browse() {
    let sections: any = {};

    let promises = [
      this.getRecentDashboards(sections),
      this.getStarred(sections),
      this.getDashboardsAndFolders(sections),
    ];

    return this.$q.all(promises).then(() => {
      return _.sortBy(_.values(sections), 'score');
    });
  }

  private transformToViewModel(hit) {
    hit.url = 'dashboard/' + hit.uri;
    return hit;
  }

  search(options) {
    if (!options.query && (!options.tag || options.tag.length === 0) && !options.starred) {
      return this.browse();
    }

    let query = _.clone(options);
    query.folderIds = [];
    query.type = 'dash-db';

    return this.backendSrv.search(query).then(results => {
      let section = {
        hideHeader: true,
        items: [],
        expanded: true,
      };

      for (let hit of results) {
        if (hit.type === 'dash-folder') {
          continue;
        }
        section.items.push(this.transformToViewModel(hit));
      }

      return [section];
    });
  }

  private toggleFolder(section) {
    section.expanded = !section.expanded;
    section.icon = section.expanded ? 'fa fa-folder-open' : 'fa fa-folder';

    if (section.items.length) {
      return;
    }

    let query = {
      folderIds: [section.id],
    };

    return this.backendSrv.search(query).then(results => {
      section.items = _.map(results, this.transformToViewModel);
    });
  }

  toggleSection(section) {
    section.toggle(section);
  }

  getDashboardTags() {
    return this.backendSrv.get('/api/dashboards/tags');
  }
}

coreModule.service('searchSrv', SearchSrv);
