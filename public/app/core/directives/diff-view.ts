import angular from 'angular';
import coreModule from '../core_module';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { CoreEvents } from 'app/types';

export class DeltaCtrl {
  observer: any;

  /** @ngInject */
  constructor(private $rootScope: GrafanaRootScope) {
    const waitForCompile = (mutations: any) => {
      if (mutations.length === 1) {
        this.$rootScope.appEvent(CoreEvents.jsonDiffReady);
      }
    };

    this.observer = new MutationObserver(waitForCompile);

    const observerConfig = {
      attributes: true,
      attributeFilter: ['class'],
      characterData: false,
      childList: true,
      subtree: false,
    };

    this.observer.observe(angular.element('.delta-html')[0], observerConfig);
  }

  $onDestroy() {
    this.observer.disconnect();
  }
}

export function delta() {
  return {
    controller: DeltaCtrl,
    replace: false,
    restrict: 'A',
  };
}
coreModule.directive('diffDelta', delta);

// Link to JSON line number
export class LinkJSONCtrl {
  /** @ngInject */
  constructor(private $scope: any, private $rootScope: GrafanaRootScope, private $anchorScroll: any) {}

  goToLine(line: number) {
    let unbind: () => void;

    const scroll = () => {
      this.$anchorScroll(`l${line}`);
      unbind();
    };

    this.$scope.switchView().then(() => {
      unbind = this.$rootScope.$on('json-diff-ready', scroll.bind(this));
    });
  }
}

export function linkJson() {
  return {
    controller: LinkJSONCtrl,
    controllerAs: 'ctrl',
    replace: true,
    restrict: 'E',
    scope: {
      line: '@lineDisplay',
      link: '@lineLink',
      switchView: '&',
    },
    template: `<a class="diff-linenum btn btn-inverse btn-small" ng-click="ctrl.goToLine(link)">Line {{ line }}</a>`,
  };
}
coreModule.directive('diffLinkJson', linkJson);
