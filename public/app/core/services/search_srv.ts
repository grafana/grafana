import _ from 'lodash';
import coreModule from 'app/core/core_module';

export class SearchSrv {

  /** @ngInject */
  constructor(private backendSrv) {
  }

  search(query) {
    return this.backendSrv.search(query).then(results => {

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
        let section = sections[hit.folderId];
        if (!section) {
          section = {
            id: hit.folderId,
            title: hit.folderTitle,
            items: [],
            icon: 'fa fa-folder-open'
          };
          // handle root
          if (!hit.folderId) {
            section.title = "Dashboards";
            section.icon = "fa fa-circle-o";
          }
          sections[hit.folderId] = section;
        }

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
