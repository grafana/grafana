"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _graph_class = _interopRequireDefault(require("./graph_class"));

var _statesHandler = _interopRequireDefault(require("./statesHandler"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var Flowchart = function () {
  function Flowchart(name, xmlGraph, container, ctrl, data) {
    _classCallCheck(this, Flowchart);

    u.log(1, "flowchart[".concat(name, "].constructor()"));
    u.log(0, "flowchart[".concat(name, "].constructor() data"), data);
    this.data = data;
    this.data.name = name;
    this.data.xml = xmlGraph;
    this.data.download = false;
    this.container = container;
    this.xgraph = undefined;
    this.stateHandler = undefined;
    this.ctrl = ctrl;
    this.templateSrv = ctrl.templateSrv;
    this["import"](data);
  }

  _createClass(Flowchart, [{
    key: "import",
    value: function _import(obj) {
      u.log(1, "flowchart[".concat(this.data.name, "].import()"));
      u.log(0, "flowchart[".concat(this.data.name, "].import() obj"), obj);
      this.data.download = obj.download !== undefined ? obj.download : false;
      if (obj.source) this.data.type = obj.source.type;else this.data.type = obj.type || this.data.type || 'xml';
      if (obj.source) this.data.xml = obj.source.xml.value;else this.data.xml = obj.xml || this.data.xml || '';
      if (obj.source) this.data.url = obj.source.url.value;else this.data.url = obj.url !== undefined ? obj.url : 'http://<source>:<port>/<pathToXml>';
      if (obj.options) this.data.zoom = obj.options.zoom;else this.data.zoom = obj.zoom || '100%';
      if (obj.options) this.data.center = obj.options.center;else this.data.center = obj.center !== undefined ? obj.center : true;
      if (obj.options) this.data.scale = obj.options.scale;else this.data.scale = obj.scale !== undefined ? obj.scale : true;
      if (obj.options) this.data.lock = obj.options.lock;else this.data.lock = obj.lock !== undefined ? obj.lock : true;
      if (obj.options) this.data.allowDrawio = false;else this.data.allowDrawio = obj.allowDrawio !== undefined ? obj.allowDrawio : false;
      if (obj.options) this.data.tooltip = obj.options.tooltip;else this.data.tooltip = obj.tooltip !== undefined ? obj.tooltip : true;
      if (obj.options) this.data.grid = obj.options.grid;else this.data.grid = obj.grid !== undefined ? obj.grid : false;
      if (obj.options) this.data.bgColor = obj.options.bgColor;else this.data.bgColor = obj.bgColor;
      this.data.editorUrl = obj.editorUrl !== undefined ? obj.editorUrl : "https://www.draw.io";
      this.data.editorTheme = obj.editorTheme !== undefined ? obj.editorTheme : "dark";
      this.init();
    }
  }, {
    key: "getData",
    value: function getData() {
      return this.data;
    }
  }, {
    key: "updateStates",
    value: function updateStates(rules) {
      var _this = this;

      rules.forEach(function (rule) {
        rule.states = _this.stateHandler.getStatesForRule(rule);
        rule.states.forEach(function (state) {
          state.unsetState();
        });
      });
    }
  }, {
    key: "init",
    value: function init() {
      u.log(1, "flowchart[".concat(this.data.name, "].init()"));
      if (this.xgraph === undefined) this.xgraph = new _graph_class["default"](this.container, this.data.type, this.getContent());

      if (this.data.xml !== undefined && this.data.xml !== null) {
        if (this.data.allowDrawio) this.xgraph.allowDrawio(true);else this.xgraph.allowDrawio(false);
        this.setOptions();
        this.xgraph.drawGraph();
        if (this.data.tooltip) this.xgraph.tooltipGraph(true);
        if (this.data.scale) this.xgraph.scaleGraph(true);else this.xgraph.zoomGraph(this.data.zoom);
        if (this.data.center) this.xgraph.centerGraph(true);
        if (this.data.lock) this.xgraph.lockGraph(true);
        this.stateHandler = new _statesHandler["default"](this.xgraph, this.ctrl);
      } else {
        u.log(3, 'XML Graph not defined');
      }
    }
  }, {
    key: "getStateHandler",
    value: function getStateHandler() {
      return this.stateHandler;
    }
  }, {
    key: "getXGraph",
    value: function getXGraph() {
      return this.xgraph;
    }
  }, {
    key: "setStates",
    value: function setStates(rules, series) {
      u.log(1, "flowchart[".concat(this.data.name, "].setStates()"));
      u.log(0, "flowchart[".concat(this.data.name, "].setStates() rules"), rules);
      u.log(0, "flowchart[".concat(this.data.name, "].setStates() series"), series);
      if (rules === undefined) u.log(3, "Rules shoudn't be null");
      if (series === undefined) u.log(3, "Series shoudn't be null");
      this.stateHandler.setStates(rules, series);
    }
  }, {
    key: "setOptions",
    value: function setOptions() {
      this.setScale(this.data.scale);
      this.setCenter(this.data.center);
      this.setGrid(this.data.grid);
      this.setTooltip(this.data.tooltip);
      this.setLock(this.data.lock);
      this.setZoom(this.data.zoom);
      this.setBgColor(this.data.bgColor);
    }
  }, {
    key: "applyStates",
    value: function applyStates() {
      u.log(1, "flowchart[".concat(this.data.name, "].applyStates()"));
      this.stateHandler.applyStates();
    }
  }, {
    key: "applyOptions",
    value: function applyOptions() {
      u.log(1, "flowchart[".concat(this.data.name, "].refresh()"));
      u.log(0, "flowchart[".concat(this.data.name, "].refresh() data"), this.data);
      this.xgraph.applyGraph(this.width, this.height);
    }
  }, {
    key: "refresh",
    value: function refresh() {
      this.xgraph.refresh();
    }
  }, {
    key: "redraw",
    value: function redraw(xmlGraph) {
      u.log(1, "flowchart[".concat(this.data.name, "].redraw()"));

      if (xmlGraph !== undefined) {
        this.data.xml = xmlGraph;
        this.xgraph.setXmlGraph(this.getXml(true));
      } else {
        u.log(2, 'XML Content not defined');
        this.xgraph.setXmlGraph(this.getXml(true));
      }

      this.applyOptions();
    }
  }, {
    key: "reload",
    value: function reload() {
      u.log(1, "flowchart[".concat(this.data.name, "].reload()"));

      if (this.xgraph !== undefined && this.xgraph !== null) {
        this.xgraph.destroyGraph();
        this.xgraph = undefined;
        this.init();
      } else this.init();
    }
  }, {
    key: "setLock",
    value: function setLock(bool) {
      this.data.lock = bool;
      this.xgraph.lock = bool;
    }
  }, {
    key: "lock",
    value: function lock(bool) {
      if (bool !== undefined) this.data.lock = bool;
      this.xgraph.lockGraph(this.data.lock);
    }
  }, {
    key: "setTooltip",
    value: function setTooltip(bool) {
      this.data.tooltip = bool;
      this.xgraph.tooltip = bool;
    }
  }, {
    key: "tooltip",
    value: function tooltip(bool) {
      if (bool !== undefined) this.data.tooltip = bool;
      this.xgraph.tooltipGraph(this.data.tooltip);
    }
  }, {
    key: "setScale",
    value: function setScale(bool) {
      this.data.scale = bool;
      this.xgraph.scale = bool;
    }
  }, {
    key: "setBgColor",
    value: function setBgColor(bgColor) {
      this.data.bgColor = bgColor;
      this.xgraph.bgColor = bgColor;
    }
  }, {
    key: "bgColor",
    value: function bgColor(_bgColor) {
      this.data.bgColor = _bgColor;
      if (_bgColor) this.xgraph.bgGraph(_bgColor);
    }
  }, {
    key: "scale",
    value: function scale(bool) {
      u.log(1, 'Flowchart.scale()');
      if (bool !== undefined) this.data.scale = bool;
      this.xgraph.scaleGraph(this.data.scale);
    }
  }, {
    key: "setCenter",
    value: function setCenter(bool) {
      this.data.center = bool;
      this.xgraph.center = bool;
    }
  }, {
    key: "getNamesByProp",
    value: function getNamesByProp(prop) {
      return this.xgraph.getOrignalCells(prop);
    }
  }, {
    key: "getXml",
    value: function getXml(replaceVarBool) {
      u.log(1, "flowchart[".concat(this.data.name, "].getXml()"));
      if (!replaceVarBool) return this.data.xml;
      return this.templateSrv.replaceWithText(this.data.xml);
    }
  }, {
    key: "getCsv",
    value: function getCsv(replaceVarBool) {
      u.log(1, "flowchart[".concat(this.data.name, "].getXml()"));
      if (!replaceVarBool) return this.data.csv;
      return this.templateSrv.replaceWithText(this.data.csv);
    }
  }, {
    key: "getUrlEditor",
    value: function getUrlEditor() {
      return this.data.editorUrl;
    }
  }, {
    key: "getThemeEditor",
    value: function getThemeEditor() {
      return this.data.editorTheme;
    }
  }, {
    key: "getContent",
    value: function getContent() {
      u.log(1, "flowchart[".concat(this.data.name, "].getContent()"));

      if (this.data.download) {
        var content = this.loadContent(this.data.url);

        if (content !== null) {
          return content;
        } else return '';
      } else {
        if (this.data.type === 'xml') return this.getXml(true);
        if (this.data.type === 'csv') return this.getCsv(true);
      }
    }
  }, {
    key: "loadContent",
    value: function loadContent(url) {
      u.log(1, "flowchart[".concat(this.data.name, "].loadContent()"));
      var req = mxUtils.load(url);

      if (req.getStatus() === 200) {
        return req.getText();
      } else {
        u.log(3, 'Cannot load ' + url, req.getStatus());
        return null;
      }
    }
  }, {
    key: "renameId",
    value: function renameId(oldId, newId) {
      this.xgraph.renameId(oldId, newId);
    }
  }, {
    key: "applyModel",
    value: function applyModel() {
      this.xmlGraph = this.xgraph.getXmlModel();
      this.redraw(this.xmlGraph);
    }
  }, {
    key: "center",
    value: function center(bool) {
      if (bool !== undefined) this.data.center = bool;
      this.xgraph.centerGraph(this.data.center);
    }
  }, {
    key: "setZoom",
    value: function setZoom(percent) {
      this.data.zoom = percent;
      this.xgraph.zoomPercent = percent;
    }
  }, {
    key: "zoom",
    value: function zoom(percent) {
      if (percent !== undefined) this.data.percent = percent;
      this.xgraph.zoomGraph(this.data.percent);
    }
  }, {
    key: "setGrid",
    value: function setGrid(bool) {
      this.data.grid = bool;
      this.xgraph.grid = bool;
    }
  }, {
    key: "grid",
    value: function grid(bool) {
      if (bool !== undefined) this.data.grid = bool;
      this.xgraph.gridGraph(this.data.grid);
    }
  }, {
    key: "setWidth",
    value: function setWidth(width) {
      this.width = width;
    }
  }, {
    key: "setHeight",
    value: function setHeight(height) {
      this.height = height;
    }
  }, {
    key: "setXml",
    value: function setXml(xml) {
      this.data.xml = xml;
    }
  }, {
    key: "minify",
    value: function minify() {
      this.data.xml = u.minify(this.data.xml);
    }
  }, {
    key: "prettify",
    value: function prettify() {
      this.data.xml = u.prettify(this.data.xml);
    }
  }, {
    key: "decode",
    value: function decode() {
      if (u.isencoded(this.data.xml)) this.data.xml = u.decode(this.data.xml, true, true, true);
    }
  }, {
    key: "encode",
    value: function encode() {
      if (!u.isencoded(this.data.xml)) this.data.xml = u.encode(this.data.xml, true, true, true);
    }
  }, {
    key: "getContainer",
    value: function getContainer() {
      return this.container;
    }
  }, {
    key: "setMap",
    value: function setMap(onMappingObj) {
      u.log(1, "flowchart[".concat(this.data.name, "].setMap()"));
      var container = this.getContainer();
      this.xgraph.setMap(onMappingObj);
      container.scrollIntoView();
      container.focus();
    }
  }, {
    key: "unsetMap",
    value: function unsetMap() {
      this.xgraph.unsetMap();
    }
  }]);

  return Flowchart;
}();

exports["default"] = Flowchart;
