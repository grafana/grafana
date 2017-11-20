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
          };
        }
      }

      sections[0] = {
        id: 0,
        title: 'Root',
        items: [],
        icon: 'fa fa-folder-open',
        score: _.keys(sections).length,
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

    options.folderIds = [];
    options.type = 'dash-db';

    return this.backendSrv.search(options).then(results => {

      let section = {
        hideHeader: true,
        items: [],
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

  getDashboardTags() {
    return this.backendSrv.get('/api/dashboards/tags');
  }
}

coreModule.service('searchSrv', SearchSrv);
