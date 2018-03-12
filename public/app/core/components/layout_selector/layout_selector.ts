import store from 'app/core/store';
import coreModule from 'app/core/core_module';

var template = `
<div class="layout-selector">
  <button ng-click="ctrl.listView()" ng-class="{active: ctrl.mode === 'list'}">
    <i class="fa fa-list"></i>
  </button>
  <button ng-click="ctrl.gridView()" ng-class="{active: ctrl.mode === 'grid'}">
    <i class="fa fa-th"></i>
  </button>
</div>
`;

export class LayoutSelectorCtrl {
  mode: string;

  /** @ngInject **/
  constructor(private $rootScope) {
    this.mode = store.get('grafana.list.layout.mode') || 'grid';
  }

  listView() {
    this.mode = 'list';
    store.set('grafana.list.layout.mode', 'list');
    this.$rootScope.appEvent('layout-mode-changed', 'list');
  }

  gridView() {
    this.mode = 'grid';
    store.set('grafana.list.layout.mode', 'grid');
    this.$rootScope.appEvent('layout-mode-changed', 'grid');
  }
}

/** @ngInject **/
export function layoutSelector() {
  return {
    restrict: 'E',
    controller: LayoutSelectorCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {},
    template: template,
  };
}

/** @ngInject **/
export function layoutMode($rootScope) {
  return {
    restrict: 'A',
    scope: {},
    link: function(scope, elem) {
      var layout = store.get('grafana.list.layout.mode') || 'grid';
      var className = 'card-list-layout-' + layout;
      elem.addClass(className);

      $rootScope.onAppEvent(
        'layout-mode-changed',
        (evt, newLayout) => {
          elem.removeClass(className);
          className = 'card-list-layout-' + newLayout;
          elem.addClass(className);
        },
        scope
      );
    },
  };
}

coreModule.directive('layoutSelector', layoutSelector);
coreModule.directive('layoutMode', layoutMode);
