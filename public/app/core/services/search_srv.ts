import _ from 'lodash';
import coreModule from 'app/core/core_module';

export class SearchSrv {

  /** @ngInject */
  constructor(private backendSrv) {
  }

  browse() {
    let query = {
      folderIds: [0]
    };

    return this.backendSrv.search(query).then(results => {

      let sections: any = {};

      for (let hit of results) {
        if (hit.type === 'dash-folder') {
          sections[hit.id] = {
            id: hit.id,
            title: hit.title,
            items: [],
            icon: 'fa fa-folder',
            score: _.keys(sections).length,
            uri: hit.uri
          };
        }
      }

      sections[0] = {
        id: 0,
        title: 'Root',
        items: [],
        icon: 'fa fa-folder-open',
        score: _.keys(sections).length,
        expanded: true
      };

      for (let hit of results) {
        if (hit.type === 'dash-folder') {
          continue;
        }
        let section = sections[hit.folderId || 0];
        hit.url = 'dashboard/' + hit.uri;
        section.items.push(hit);
      }

      return _.sortBy(_.values(sections), 'score');
    });
  }

  search(options) {
    if (!options.query) {
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
        hit.url = 'dashboard/' + hit.uri;
        section.items.push(hit);
      }

      return [section];
    });
  }

  toggleFolder(section) {
    section.expanded = !section.expanded;
    section.icon = section.expanded ? 'fa fa-folder-open' : 'fa fa-folder';

    if (section.items.length) {
      return;
    }

    let query = {
      folderIds: [section.id]
    };

    return this.backendSrv.search(query).then(results => {
      for (let hit of results) {
        hit.url = 'dashboard/' + hit.uri;
        section.items.push(hit);
      }
    });
  }

  getDashboardTags() {
    return this.backendSrv.get('/api/dashboards/tags');
  }
}

coreModule.service('searchSrv', SearchSrv);
