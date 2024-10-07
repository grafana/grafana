export class InspectOptionsCtrl {
  /** @ngInject */
  constructor($scope) {
    $scope.editor = this;
    this.enable = false;
    $scope.GF_PLUGIN = window.GF_PLUGIN;
    this.$scope = $scope;
    this.ctrl = $scope.ctrl;
    this.panel = this.ctrl.panel;
    this.logDisplayOption = [{ text: 'True', value: true }, { text: 'False', value: false }];
    this.logLevelOption = [
      { text: 'DEBUG', value: 0 },
      { text: 'INFO', value: 1 },
      { text: 'WARNING', value: 2 },
      { text: 'ERROR', value: 3 },
    ];
    this.logLevel = GF_PLUGIN.logLevel;
    this.logDisplay = GF_PLUGIN.logDisplay;

    this.flowchartHandler = this.ctrl.flowchartHandler;
    $scope.flowchartHandler = this.ctrl.flowchartHandler;
  }

  render() {
    this.panelCtrl.render();
  }

  onColorChange(styleIndex, colorIndex) {
    return (newColor) => {
      this.colors[colorIndex] = newColor;
    };
  }

  onDebug() {
    GF_PLUGIN.logLevel = this.logLevel;
    GF_PLUGIN.logDisplay = this.logDisplay;
  }

  onChangeId(state) {
    if (state.newcellId !== undefined && state.cellId !== state.newcellId) {
      this.flowchartHandler.getFlowchart(0).getStateHandler().edited = true;
      if (state.previousId === undefined) state.previousId = state.cellId;
      state.cellId = state.newcellId;
      state.edited = true;
    }
    state.edit = false;
  }

  onEdit(state) {
    state.edit = true;
    state.newcellId = state.cellId;
    let elt = document.getElementById(state.cellId);
    setTimeout(function () {
      elt.focus();
    }, 100);
  }

  reset() {
    this.flowchartHandler.draw();
    this.flowchartHandler.refresh();
    // this.$scope.$apply();
  }

  apply() {
    const flowchart = this.flowchartHandler.getFlowchart(0);
    const states = flowchart.getStateHandler().getStates();
    states.forEach((state) => {
      if (state.edited) flowchart.renameId(state.previousId, state.cellId);
    });
    flowchart.applyModel();
  }

  selectCell(state) {
    state.highlightCell();
  }

  unselectCell(state) {
    state.unhighlightCell();
  }
}

/** @ngInject */
export function inspectOptionsTab($q, uiSegmentSrv) {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: `${GF_PLUGIN.getPartialPath()}/inspect_options.html`,
    controller: InspectOptionsCtrl
  };
}
