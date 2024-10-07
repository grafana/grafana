"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MetricsPanelCtrl = exports.FlowchartCtrl = void 0;

var _sdk = require("app/plugins/sdk");

var _time_series = _interopRequireDefault(require("app/core/time_series2"));

var _kbn = _interopRequireDefault(require("app/core/utils/kbn"));

var _mapping_options = require("./mapping_options");

var _flowchart_options = require("./flowchart_options");

var _inspect_options = require("./inspect_options");

var _rulesHandler = _interopRequireDefault(require("./rulesHandler"));

var _flowchartHandler = _interopRequireDefault(require("./flowchartHandler"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var u = require('./utils');

window.u = window.u || u;

var FlowchartCtrl = function (_MetricsPanelCtrl) {
  _inherits(FlowchartCtrl, _MetricsPanelCtrl);

  function FlowchartCtrl($scope, $injector, $rootScope, templateSrv) {
    var _this;

    _classCallCheck(this, FlowchartCtrl);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(FlowchartCtrl).call(this, $scope, $injector));
    _this.version = '0.5.0';
    _this.$rootScope = $rootScope;
    _this.$scope = $scope;
    _this.templateSrv = templateSrv;
    _this.unitFormats = _kbn["default"].getUnitFormats();
    _this.changedSource = true;
    _this.changedData = true;
    _this.changedOptions = true;
    _this.rulesHandler = undefined;
    _this.flowchartHandler = undefined;
    _this.series = [];
    _this.panelDefaults = {
      newFlag: true,
      format: 'short',
      valueName: 'current',
      rulesData: [],
      flowchartsData: []
    };

    _.defaults(_this.panel, _this.panelDefaults);

    _this.panel.graphId = "flowchart_".concat(_this.panel.id);
    _this.containerDivId = "container_".concat(_this.panel.graphId);

    _this.events.on('render', _this.onRender.bind(_assertThisInitialized(_this)));

    _this.events.on('refresh', _this.onRefresh.bind(_assertThisInitialized(_this)));

    _this.events.on('data-received', _this.onDataReceived.bind(_assertThisInitialized(_this)));

    _this.events.on('data-error', _this.onDataError.bind(_assertThisInitialized(_this)));

    _this.events.on('data-snapshot-load', _this.onDataReceived.bind(_assertThisInitialized(_this)));

    _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_assertThisInitialized(_this)));

    _this.events.on('init-panel-actions', _this.onInitPanelActions.bind(_assertThisInitialized(_this)));

    _this.events.on('template-variable-value-updated', _this.onVarChanged.bind(_assertThisInitialized(_this)));

    _this.dashboard.events.on('template-variable-value-updated', _this.onVarChanged.bind(_assertThisInitialized(_this)), $scope);

    $rootScope.onAppEvent('template-variable-value-updated', _this.onVarChanged.bind(_assertThisInitialized(_this)), $scope);
    return _this;
  }

  _createClass(FlowchartCtrl, [{
    key: "onInitEditMode",
    value: function onInitEditMode() {
      this.addEditorTab('Flowchart', _flowchart_options.flowchartOptionsTab, 2);
      this.addEditorTab('Mapping', _mapping_options.mappingOptionsTab, 3);
      this.addEditorTab('Inspect', _inspect_options.inspectOptionsTab, 4);
    }
  }, {
    key: "onRefresh",
    value: function onRefresh() {
      u.log(1, 'FlowchartCtrl.onRefresh()');
      this.onRender();
    }
  }, {
    key: "onVarChanged",
    value: function onVarChanged() {
      u.log(1, 'FlowchartCtrl.onVarChanged()');
      this.flowchartHandler.sourceChanged();
      this.flowchartHandler.render();
    }
  }, {
    key: "onRender",
    value: function onRender() {
      u.log(1, 'FlowchartCtrl.onRender()');
    }
  }, {
    key: "onDataReceived",
    value: function onDataReceived(dataList) {
      u.log(1, 'FlowchartCtrl.onDataReceived()');
      u.log(0, 'FlowchartCtrl.onDataReceived() dataList', dataList);
      this.series = dataList.map(this.seriesHandler.bind(this));
      u.log(0, 'FlowchartCtrl.onDataReceived() this.series', dataList);
      this.flowchartHandler.dataChanged();
      this.render();
    }
  }, {
    key: "onDataError",
    value: function onDataError() {
      this.series = [];
      this.render();
    }
  }, {
    key: "onInitPanelActions",
    value: function onInitPanelActions(actions) {
      actions.push({
        text: 'Export SVG',
        click: 'ctrl.exportSVG()'
      });
    }
  }, {
    key: "link",
    value: function link(scope, elem, attrs, ctrl) {
      u.log(1, 'FlowchartCtrl.link()');
      var newRulesData = [];
      this.rulesHandler = new _rulesHandler["default"](scope, newRulesData);

      if (this.panel.version === undefined && this.panel.styles !== undefined) {
        this.rulesHandler["import"](this.panel.styles);
        delete this.panel.styles;
      } else this.rulesHandler["import"](this.panel.rulesData);

      if (this.panel.newFlag && this.rulesHandler.countRules() === 0) this.rulesHandler.addRule('.*');
      this.panel.rulesData = newRulesData;
      var newFlowchartsData = [];
      this.flowchartHandler = new _flowchartHandler["default"](scope, elem, ctrl, newFlowchartsData);

      if (this.panel.version === undefined && this.panel.flowchart !== undefined) {
        this.flowchartHandler["import"]([this.panel.flowchart]);
        delete this.panel.flowchart;
      } else this.flowchartHandler["import"](this.panel.flowchartsData);

      if (this.panel.newFlag && this.flowchartHandler.countFlowcharts() === 0) this.flowchartHandler.addFlowchart('Main');
      this.panel.flowchartsData = newFlowchartsData;
      this.panel.newFlag = false;
      this.panel.version = this.version;
    }
  }, {
    key: "exportSVG",
    value: function exportSVG() {
      var scope = this.$scope.$new(true);
      scope.panel = 'table';
      this.publishAppEvent('show-modal', {
        templateHtml: '<export-data-modal panel="panel" data="tableData"></export-data-modal>',
        scope: scope,
        modalClass: 'modal--narrow'
      });
    }
  }, {
    key: "setUnitFormat",
    value: function setUnitFormat(subItem) {
      this.panel.format = subItem.value;
      this.refresh();
    }
  }, {
    key: "getVariables",
    value: function getVariables() {
      if (this.templateSrv !== undefined && this.templateSrv !== null) {
        return _.map(this.templateSrv.variables, function (variable) {
          return "${".concat(variable.name, "}");
        });
      }

      return null;
    }
  }, {
    key: "seriesHandler",
    value: function seriesHandler(seriesData) {
      u.log(1, 'FlowchartCtrl.seriesHandler()');
      var series = new _time_series["default"]({
        datapoints: seriesData.datapoints,
        alias: seriesData.target,
        unit: seriesData.unit
      });
      series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
      var datapoints = seriesData.datapoints || [];

      if (datapoints && datapoints.length > 0) {
        var last = datapoints[datapoints.length - 1][1];
        var from = this.range.from;

        if (last - from < -10000) {
          series.isOutsideRange = true;
        }
      }

      return series;
    }
  }]);

  return FlowchartCtrl;
}(_sdk.MetricsPanelCtrl);

exports.MetricsPanelCtrl = exports.FlowchartCtrl = FlowchartCtrl;
FlowchartCtrl.templateUrl = './partials/module.html';
