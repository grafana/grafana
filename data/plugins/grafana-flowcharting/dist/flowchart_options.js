"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.flowchartOptionsTab = flowchartOptionsTab;
exports.FlowchartOptionsCtrl = void 0;

var _plugin = require("./plugin");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var FlowchartOptionsCtrl = function () {
  function FlowchartOptionsCtrl($scope) {
    _classCallCheck(this, FlowchartOptionsCtrl);

    $scope.editor = this;
    $scope.GF_PLUGIN = window.GF_PLUGIN;
    this.$scope = $scope;
    this.ctrl = $scope.ctrl;
    this.flowchartHandler = this.ctrl.flowchartHandler;
    this.panel = this.ctrl.panel;
    this.sourceTypes = [{
      text: 'XML Content',
      value: 'xml'
    }];
    this.themes = [{
      text: 'Dark',
      value: 'dark'
    }, {
      text: 'Light',
      value: 'kennedy'
    }, {
      text: 'Mobile',
      value: 'minimal'
    }, {
      text: 'Atlas',
      value: 'atlas'
    }];
  }

  _createClass(FlowchartOptionsCtrl, [{
    key: "render",
    value: function render() {
      this.flowchartHandler.render();
    }
  }, {
    key: "onSourceChange",
    value: function onSourceChange() {
      this.flowchartHandler.sourceChanged();
      this.render();
    }
  }, {
    key: "onOptionChange",
    value: function onOptionChange() {
      u.log(1, "FlowchartOptionsCtrl.onOptionChange()");
      this.flowchartHandler.optionChanged();
      this.render();
    }
  }, {
    key: "edit",
    value: function edit(index) {
      this.flowchartHandler.openDrawEditor(index);
    }
  }, {
    key: "getFlowcharts",
    value: function getFlowcharts() {
      return this.flowchartHandler.getFlowcharts();
    }
  }]);

  return FlowchartOptionsCtrl;
}();

exports.FlowchartOptionsCtrl = FlowchartOptionsCtrl;

function flowchartOptionsTab($q, $sce, uiSegmentSrv) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: "".concat(GF_PLUGIN.getPartialPath(), "/flowchart_options.html"),
    controller: FlowchartOptionsCtrl
  };
}
