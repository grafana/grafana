import coreModule from '../../core/core_module';
import { BackendSrv } from 'app/core/services/backend_srv';

export class PlaylistSearchCtrl {
  query: any;
  tagsMode: boolean;

  searchStarted: any;

  /** @ngInject */
  constructor($timeout: any, private backendSrv: BackendSrv) {
    this.query = { query: '', tag: [], starred: false, limit: 20 };

    $timeout(() => {
      this.query.query = '';
      this.query.type = 'dash-db';
      this.searchDashboards();
    }, 100);
  }

  searchDashboards() {
    this.tagsMode = false;
    const prom: any = {};

    prom.promise = this.backendSrv.search(this.query).then(result => {
      return {
        dashboardResult: result,
        tagResult: [],
      };
    });

    this.searchStarted(prom);
  }

  showStarred() {
    this.query.starred = !this.query.starred;
    this.searchDashboards();
  }

  queryHasNoFilters() {
    return this.query.query === '' && this.query.starred === false && this.query.tag.length === 0;
  }

  filterByTag(tag: any, evt: any) {
    this.query.tag.push(tag);
    this.searchDashboards();
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }

  getTags() {
    const prom: any = {};
    prom.promise = this.backendSrv.get('/api/dashboards/tags').then((result: any) => {
      return {
        dashboardResult: [],
        tagResult: result,
      } as any;
    });

    this.searchStarted(prom);
  }
}

export function playlistSearchDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/playlist/partials/playlist_search.html',
    controller: PlaylistSearchCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      searchStarted: '&',
    },
  };
}

coreModule.directive('playlistSearch', playlistSearchDirective);
