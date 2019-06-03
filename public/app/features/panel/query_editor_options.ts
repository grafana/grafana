import angular from 'angular';
import { GlobeCtrl } from 'app/plugins/globe';

const module = angular.module('grafana.directives');

export class QueryEditorOptionsCtrl {
  target: any;
  queryCtrl: any;
  panelCtrl: any;
  panel: any;
  //scope: any;
  hasTextEditMode: boolean;

  $scope: any;
  $injector: any;
  $location: any;
  $timeout: any;
  inspector: any;

  constructor($scope, $injector) {
    this.$injector = $injector;
    this.$location = $injector.get('$location');
    this.$scope = $scope;
    this.$timeout = $injector.get('$timeout');
    //  constructor(private panelCtrl: MetricsPanelCtrl) {
    //    super($scope, $injector);
    //    this.scope = $scope;
    this.queryCtrl = GlobeCtrl.prototype.getGlobe();
    this.panelCtrl = this.queryCtrl.panelCtrl;
    this.target = this.queryCtrl.target;
    this.panel = this.panelCtrl.panel;
    //    this.Ctrl = this.queryCtrl.datasource.pluginExports.QueryCtrl;

    //    if (this.hasTextEditMode && this.queryCtrl.toggleEditorMode) {
    // expose this function to react parent component
    //      this.panelCtrl.toggleEditorMode = this.queryCtrl.toggleEditorMode.bind(this.queryCtrl);
    //    }

    //    if (this.queryCtrl.getCollapsedText) {
    // expose this function to react parent component
    //      this.panelCtrl.getCollapsedText = this.queryCtrl.getCollapsedText.bind(this.queryCtrl);
    //    }
  }
}

/** @ngInject */
function queryEditorOptionsDirective() {
  return {
    restrict: 'E',
    controller: QueryEditorOptionsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    templateUrl: 'public/app/features/panel/partials/query_editor_options.html',
    transclude: true,
    scope: {
      queryCtrl: '=',
      canCollapse: '=',
      hasTextEditMode: '=',
    },
  };
}

module.directive('queryEditorOptions', queryEditorOptionsDirective);
