import _ from 'lodash';
import coreModule from 'app/core/core_module';

export class SearchSrv {

  /** @ngInject */
  constructor(private backendSrv) {
  }

  search(options) {
    if (!options.query) {
      options.folderIds = [0];
    } else {
      options.folderIds = [];
      options.type = 'dash-db';
    }

    return this.backendSrv.search(options).then(results => {

      let sections: any = {};

      // sections["starred"] = {
      //   score: 0,
      //   icon: 'fa fa-star-o',
      //   title: "Starred dashboards",
      //   items: [
      //     {title: 'Frontend Nginx'},
      //     {title: 'Cassandra overview'}
      //   ]
      // };
      //
      // sections["recent"] = {
      //   score: 1,
      //   icon: 'fa fa-clock-o',
      //   title: "Recent dashboards",
      //   items: [
      //     {title: 'Frontend Nginx'},
      //     {title: 'Cassandra overview'}
      //   ]
      // };

      // create folder index
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

  getDashboardTags() {
    return this.backendSrv.get('/api/dashboards/tags');
  }
}

coreModule.service('searchSrv', SearchSrv);
