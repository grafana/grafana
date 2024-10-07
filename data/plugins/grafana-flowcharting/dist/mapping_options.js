"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mappingOptionsTab = mappingOptionsTab;
exports.MappingOptionsCtrl = void 0;

var _kbn = _interopRequireDefault(require("app/core/utils/kbn"));

var _plugin = require("./plugin");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var MappingOptionsCtrl = function () {
  function MappingOptionsCtrl($scope) {
    var _this = this;

    _classCallCheck(this, MappingOptionsCtrl);

    $scope.editor = this;
    $scope.GF_PLUGIN = window.GF_PLUGIN;
    this.$scope = $scope;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    $scope.rulesHandler = this.panelCtrl.rulesHandler;
    $scope.flowchartHandler = this.panelCtrl.flowchartHandler;
    this.flowchartHandler = $scope.ctrl.flowchartHandler;
    this.rulesHandler = this.panelCtrl.rulesHandler;
    this.unitFormats = _kbn["default"].getUnitFormats();
    this.style = [{
      text: 'Disabled',
      value: 'disabled'
    }, {
      text: 'Stroke',
      value: 'strokeColor'
    }, {
      text: 'Fill',
      value: 'fillColor'
    }, {
      text: 'Text',
      value: 'fontColor'
    }, {
      text: 'Background (image)',
      value: 'imageBackground'
    }, {
      text: 'Border (image)',
      value: 'imageBorder'
    }];
    this.colorOn = [{
      text: 'Never',
      value: 'n'
    }, {
      text: 'Warning / Critical',
      value: 'wc'
    }, {
      text: 'Always',
      value: 'a'
    }];
    this.linkOn = [{
      text: 'Warning / Critical',
      value: 'wc'
    }, {
      text: 'Always',
      value: 'a'
    }];
    this.tooltipOn = [{
      text: 'Warning / Critical',
      value: 'wc'
    }, {
      text: 'Always',
      value: 'a'
    }];
    this.tpDirection = [{
      text: 'Vertical',
      value: 'v'
    }, {
      text: 'Horizontal ',
      value: 'h'
    }];
    this.textOn = [{
      text: 'Never',
      value: 'n'
    }, {
      text: 'When Metric Displayed',
      value: 'wmd'
    }, {
      text: 'Warning / Critical',
      value: 'wc'
    }, {
      text: 'Critical Only',
      value: 'co'
    }];
    this.textReplace = [{
      text: 'All content',
      value: 'content'
    }, {
      text: 'Substring',
      value: 'pattern'
    }, {
      text: 'Append (Space) ',
      value: 'as'
    }, {
      text: 'Append (New line) ',
      value: 'anl'
    }];
    this.propTypes = [{
      text: 'Id',
      value: 'id'
    }];
    this.textPattern = '/.*/';
    this.metricTypes = [{
      text: 'Number',
      value: 'number'
    }, {
      text: 'String',
      value: 'string'
    }, {
      text: 'Date',
      value: 'date'
    }];
    this.dateFormats = [{
      text: 'YYYY-MM-DD HH:mm:ss',
      value: 'YYYY-MM-DD HH:mm:ss'
    }, {
      text: 'YYYY-MM-DD HH:mm:ss.SSS',
      value: 'YYYY-MM-DD HH:mm:ss.SSS'
    }, {
      text: 'MM/DD/YY h:mm:ss a',
      value: 'MM/DD/YY h:mm:ss a'
    }, {
      text: 'MMMM D, YYYY LT',
      value: 'MMMM D, YYYY LT'
    }, {
      text: 'YYYY-MM-DD',
      value: 'YYYY-MM-DD'
    }];
    this.aggregationTypes = [{
      text: 'First',
      value: 'first'
    }, {
      text: 'Last',
      value: 'current'
    }, {
      text: 'Min',
      value: 'min'
    }, {
      text: 'Max',
      value: 'max'
    }, {
      text: 'Sum',
      value: 'total'
    }, {
      text: 'Avg',
      value: 'avg'
    }, {
      text: 'Count',
      value: 'count'
    }, {
      text: 'Delta',
      value: 'delta'
    }, {
      text: 'Range',
      value: 'range'
    }, {
      text: 'Diff',
      value: 'diff'
    }];
    this.mappingTypes = [{
      text: 'Value to text',
      value: 1
    }, {
      text: 'Range to text',
      value: 2
    }];
    this.tpGraphType = [{
      text: 'Line',
      value: 'line'
    }];
    this.tpGraphSize = [{
      text: 'Adjustable',
      value: '100%'
    }, {
      text: 'Small',
      value: '100px'
    }, {
      text: 'Medium',
      value: '200px'
    }, {
      text: 'Large',
      value: '400px'
    }];

    this.getMetricNames = function () {
      if (!_this.panelCtrl.series) {
        return [];
      }

      return _.map(_this.panelCtrl.series, function (t) {
        return t.alias;
      });
    };

    this.getCellNamesForShape = function () {
      u.log(1, 'MappingOptionsCtrl.getCellNamesForShape()');

      var flowchart = _this.flowchartHandler.getFlowchart(0);

      var cells = flowchart.getNamesByProp('id');
      return _.map(cells, function (t) {
        return t;
      });
    };

    this.getCellNamesForText = function () {
      u.log(1, 'MappingOptionsCtrl.getCellNamesForText()');

      var flowchart = _this.flowchartHandler.getFlowchart(0);

      var cells = flowchart.getNamesByProp('id');
      return _.map(cells, function (t) {
        return t;
      });
    };

    this.getCellNamesForLink = function () {
      u.log(1, 'MappingOptionsCtrl.getCellNamesForLink()');

      var flowchart = _this.flowchartHandler.getFlowchart(0);

      var cells = flowchart.getNamesByProp('id');
      return _.map(cells, function (t) {
        return t;
      });
    };

    this.getVariables = function () {
      u.log('MappingOptionsCtrl.getVariables');
      return _this.panelCtrl.getVariables();
    };
  }

  _createClass(MappingOptionsCtrl, [{
    key: "render",
    value: function render() {
      this.panelCtrl.render();
    }
  }, {
    key: "setUnitFormat",
    value: function setUnitFormat(rule, subItem) {
      rule.unit = subItem.value;
      this.onRulesChange();
    }
  }, {
    key: "onRulesChange",
    value: function onRulesChange() {
      u.log(1, 'MappingOptionsCtrl.onRulesChange()');
      this.flowchartHandler.ruleChanged();
      this.render();
    }
  }, {
    key: "onColorChange",
    value: function onColorChange(ruleIndex, colorIndex) {
      var _this2 = this;

      return function (newColor) {
        var rule = _this2.rulesHandler.getRule(ruleIndex);

        rule.data.colors[colorIndex] = newColor;

        _this2.onRulesChange();
      };
    }
  }, {
    key: "selectCell",
    value: function selectCell(prop, value) {
      var flowchart = this.flowchartHandler.getFlowchart(0);
      var xgraph = flowchart.getXGraph();
      xgraph.selectMxCells(prop, value);
    }
  }, {
    key: "unselectCell",
    value: function unselectCell(prop, value) {
      var flowchart = this.flowchartHandler.getFlowchart(0);
      var xgraph = flowchart.getXGraph();
      xgraph.unselectMxCells(prop, value);
    }
  }, {
    key: "highlightCells",
    value: function highlightCells(rule) {
      rule.highlightCells();
    }
  }, {
    key: "unhighlightCells",
    value: function unhighlightCells(rule) {
      rule.unhighlightCells();
    }
  }]);

  return MappingOptionsCtrl;
}();

exports.MappingOptionsCtrl = MappingOptionsCtrl;

function mappingOptionsTab($q, uiSegmentSrv) {
  'use strict';

  return {
    restrict: 'E',
    scope: true,
    templateUrl: "".concat(GF_PLUGIN.getPartialPath(), "/mapping_options.html"),
    controller: MappingOptionsCtrl
  };
}
