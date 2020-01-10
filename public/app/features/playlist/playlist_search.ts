import { IScope, ITimeoutService } from 'angular';

import coreModule from '../../core/core_module';
import { backendSrv } from 'app/core/services/backend_srv';
import { promiseToDigest } from '../../core/utils/promiseToDigest';

export class PlaylistSearchCtrl {
  query: any;
  tagsMode: boolean;

  searchStarted: any;

  /** @ngInject */
  constructor(private $scope: IScope, $timeout: ITimeoutService) {
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

    prom.promise = promiseToDigest(this.$scope)(
      backendSrv.search(this.query).then(result => {
        return {
          dashboardResult: result,
          tagResult: [],
        };
      })
    );

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
    prom.promise = promiseToDigest(this.$scope)(
      backendSrv.get('/api/dashboards/tags').then((result: any) => {
        return {
          dashboardResult: [],
          tagResult: result,
        } as any;
      })
    );

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
