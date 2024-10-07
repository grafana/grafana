/* eslint-disable no-unused-vars */
import { plugin } from './plugin';

export class FlowchartOptionsCtrl {
  /** @ngInject */
  constructor($scope) {
    $scope.editor = this;
    $scope.GF_PLUGIN = window.GF_PLUGIN;
    this.$scope = $scope;
    this.ctrl = $scope.ctrl;
    this.flowchartHandler = this.ctrl.flowchartHandler;
    this.panel = this.ctrl.panel;
    this.sourceTypes = [{ text: 'XML Content', value: 'xml' }]
    this.themes = [
      { text: 'Dark', value: 'dark' },
      { text: 'Light', value: 'kennedy' },
      { text: 'Mobile', value: 'minimal' },
      { text: 'Atlas', value: 'atlas' },
    ];
    //,{ text: 'CSV', value: 'csv' }];
  }

  /**
   *Render
   *
   * @memberof FlowchartOptionsCtrl
   */
  render() {
    this.flowchartHandler.render();
  }

  /**
   * onSourceChange event when source changes
   *
   * @memberof FlowchartOptionsCtrl
   */
  onSourceChange() {
    this.flowchartHandler.sourceChanged();
    this.render();
  }

  /**
   * onOptionChange event when options change
   *
   * @memberof FlowchartOptionsCtrl
   */
  onOptionChange() {
    u.log(1, "FlowchartOptionsCtrl.onOptionChange()");
    this.flowchartHandler.optionChanged();
    this.render();
  }

  /**
   * Open graph in index in draw.io
   *
   * @param {Number} index - index of graph
   * @memberof FlowchartOptionsCtrl
   * @see flowchartHandler:openDrawEditor
   */
  edit(index) {
    this.flowchartHandler.openDrawEditor(index);
  }

  getFlowcharts() {
    return this.flowchartHandler.getFlowcharts();
  }
}

/** @ngInject */
export function flowchartOptionsTab($q, $sce, uiSegmentSrv) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: `${GF_PLUGIN.getPartialPath()}/flowchart_options.html`,
    controller: FlowchartOptionsCtrl,
  };
}
