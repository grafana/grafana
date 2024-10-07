"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.inspectOptionsTab = inspectOptionsTab;
exports.InspectOptionsCtrl = void 0;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var InspectOptionsCtrl = function () {
  function InspectOptionsCtrl($scope) {
    _classCallCheck(this, InspectOptionsCtrl);

    $scope.editor = this;
    this.enable = false;
    $scope.GF_PLUGIN = window.GF_PLUGIN;
    this.$scope = $scope;
    this.ctrl = $scope.ctrl;
    this.panel = this.ctrl.panel;
    this.logDisplayOption = [{
      text: 'True',
      value: true
    }, {
      text: 'False',
      value: false
    }];
    this.logLevelOption = [{
      text: 'DEBUG',
      value: 0
    }, {
      text: 'INFO',
      value: 1
    }, {
      text: 'WARNING',
      value: 2
    }, {
      text: 'ERROR',
      value: 3
    }];
    this.logLevel = GF_PLUGIN.logLevel;
    this.logDisplay = GF_PLUGIN.logDisplay;
    this.flowchartHandler = this.ctrl.flowchartHandler;
    $scope.flowchartHandler = this.ctrl.flowchartHandler;
  }

  _createClass(InspectOptionsCtrl, [{
    key: "render",
    value: function render() {
      this.panelCtrl.render();
    }
  }, {
    key: "onColorChange",
    value: function onColorChange(styleIndex, colorIndex) {
      var _this = this;

      return function (newColor) {
        _this.colors[colorIndex] = newColor;
      };
    }
  }, {
    key: "onDebug",
    value: function onDebug() {
      GF_PLUGIN.logLevel = this.logLevel;
      GF_PLUGIN.logDisplay = this.logDisplay;
    }
  }, {
    key: "onChangeId",
    value: function onChangeId(state) {
      if (state.newcellId !== undefined && state.cellId !== state.newcellId) {
        this.flowchartHandler.getFlowchart(0).getStateHandler().edited = true;
        if (state.previousId === undefined) state.previousId = state.cellId;
        state.cellId = state.newcellId;
        state.edited = true;
      }

      state.edit = false;
    }
  }, {
    key: "onEdit",
    value: function onEdit(state) {
      state.edit = true;
      state.newcellId = state.cellId;
      var elt = document.getElementById(state.cellId);
      setTimeout(function () {
        elt.focus();
      }, 100);
    }
  }, {
    key: "reset",
    value: function reset() {
      this.flowchartHandler.draw();
      this.flowchartHandler.refresh();
    }
  }, {
    key: "apply",
    value: function apply() {
      var flowchart = this.flowchartHandler.getFlowchart(0);
      var states = flowchart.getStateHandler().getStates();
      states.forEach(function (state) {
        if (state.edited) flowchart.renameId(state.previousId, state.cellId);
      });
      flowchart.applyModel();
    }
  }, {
    key: "selectCell",
    value: function selectCell(state) {
      state.highlightCell();
    }
  }, {
    key: "unselectCell",
    value: function unselectCell(state) {
      state.unhighlightCell();
    }
  }]);

  return InspectOptionsCtrl;
}();

exports.InspectOptionsCtrl = InspectOptionsCtrl;

function inspectOptionsTab($q, uiSegmentSrv) {
  'use strict';

  return {
    restrict: 'E',
    scope: true,
    templateUrl: "".concat(GF_PLUGIN.getPartialPath(), "/inspect_options.html"),
    controller: InspectOptionsCtrl
  };
}
