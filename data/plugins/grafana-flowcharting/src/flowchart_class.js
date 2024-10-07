import XGraph from './graph_class';
import StateHandler from './statesHandler';

/**
 *Flowchart handler
 *
 * @export
 * @class Flowchart
 */
export default class Flowchart {
  constructor(name, xmlGraph, container, ctrl, data) {
    u.log(1, `flowchart[${name}].constructor()`);
    u.log(0, `flowchart[${name}].constructor() data`, data);
    this.data = data;
    this.data.name = name;
    this.data.xml = xmlGraph;
    this.data.download = false; 
    this.container = container;
    this.xgraph = undefined;
    this.stateHandler = undefined;
    this.ctrl = ctrl;
    this.templateSrv = ctrl.templateSrv;
    this.import(data);
  }

  /**
   *Import data object in current flowchart
   *
   * @param {Object} obj
   * @memberof Flowchart
   */
  import(obj) {
    u.log(1, `flowchart[${this.data.name}].import()`);
    u.log(0, `flowchart[${this.data.name}].import() obj`, obj);
    this.data.download = (obj.download !== undefined ? obj.download : false);
    if (obj.source) this.data.type = obj.source.type;
    else this.data.type = obj.type || this.data.type || 'xml';
    if (obj.source) this.data.xml = obj.source.xml.value;
    else this.data.xml = obj.xml || this.data.xml || '';
    if (obj.source) this.data.url = obj.source.url.value;
    else this.data.url = (obj.url !== undefined ? obj.url : 'http://<source>:<port>/<pathToXml>');
    if (obj.options) this.data.zoom = obj.options.zoom;
    else this.data.zoom = obj.zoom || '100%';
    if (obj.options) this.data.center = obj.options.center;
    else this.data.center = obj.center !== undefined ? obj.center : true;
    if (obj.options) this.data.scale = obj.options.scale;
    else this.data.scale = obj.scale !== undefined ? obj.scale : true;
    if (obj.options) this.data.lock = obj.options.lock;
    else this.data.lock = obj.lock !== undefined ? obj.lock : true;
    if (obj.options) this.data.allowDrawio = false;
    else this.data.allowDrawio = obj.allowDrawio !== undefined ? obj.allowDrawio : false;
    if (obj.options) this.data.tooltip = obj.options.tooltip;
    else this.data.tooltip = obj.tooltip !== undefined ? obj.tooltip : true;
    if (obj.options) this.data.grid = obj.options.grid;
    else this.data.grid = obj.grid !== undefined ? obj.grid : false;
    if (obj.options) this.data.bgColor = obj.options.bgColor;
    else this.data.bgColor = obj.bgColor;
    this.data.editorUrl = obj.editorUrl !== undefined ? obj.editorUrl : "https://www.draw.io";
    this.data.editorTheme = obj.editorTheme !== undefined ? obj.editorTheme : "dark";
    this.init();
  }

  /**
   * Return data without functions to save json in grafana
   *
   * @returns {Object} Data object
   * @memberof Flowchart
   */
  getData() {
    return this.data;
  }

  /**
   *Update states of flowchart/graph
   *
   * @param {*} rules
   * @memberof Flowchart
   */
  updateStates(rules) {
    // if (this.stateHandler !== undefined) this.stateHandler.updateStates(rules);
    // this.stateHandler.prepare();
    rules.forEach(rule => {
      rule.states = this.stateHandler.getStatesForRule(rule);
      rule.states.forEach(state => {
        state.unsetState();
      });
    });
  }

  /**
   *Initialisation of flowchart class
   *
   * @memberof Flowchart
   */
  init() {
    u.log(1, `flowchart[${this.data.name}].init()`);
    if (this.xgraph === undefined)
      this.xgraph = new XGraph(this.container, this.data.type, this.getContent());
    if (this.data.xml !== undefined && this.data.xml !== null) {
      if (this.data.allowDrawio) this.xgraph.allowDrawio(true);
      else this.xgraph.allowDrawio(false);
      this.setOptions();
      this.xgraph.drawGraph();
      if (this.data.tooltip) this.xgraph.tooltipGraph(true);
      if (this.data.scale) this.xgraph.scaleGraph(true);
      else this.xgraph.zoomGraph(this.data.zoom);
      if (this.data.center) this.xgraph.centerGraph(true);
      if (this.data.lock) this.xgraph.lockGraph(true);
      this.stateHandler = new StateHandler(this.xgraph, this.ctrl);
    } else {
      u.log(3, 'XML Graph not defined');
    }
  }

  getStateHandler() {
    return this.stateHandler;
  }

  getXGraph() {
    return this.xgraph;
  }

  setStates(rules, series) {
    u.log(1, `flowchart[${this.data.name}].setStates()`);
    u.log(0, `flowchart[${this.data.name}].setStates() rules`, rules);
    u.log(0, `flowchart[${this.data.name}].setStates() series`, series);
    if (rules === undefined) u.log(3, "Rules shoudn't be null");
    if (series === undefined) u.log(3, "Series shoudn't be null");
    this.stateHandler.setStates(rules, series);
  }

  setOptions() {
    this.setScale(this.data.scale);
    this.setCenter(this.data.center);
    this.setGrid(this.data.grid);
    this.setTooltip(this.data.tooltip);
    this.setLock(this.data.lock);
    this.setZoom(this.data.zoom);
    this.setBgColor(this.data.bgColor);
  }



  applyStates() {
    u.log(1, `flowchart[${this.data.name}].applyStates()`);
    this.stateHandler.applyStates();
  }

  applyOptions() {
    u.log(1, `flowchart[${this.data.name}].refresh()`);
    u.log(0, `flowchart[${this.data.name}].refresh() data`, this.data);
    this.xgraph.applyGraph(this.width, this.height);
  }

  refresh()
  {
    this.xgraph.refresh();
  }

  redraw(xmlGraph) {
    u.log(1, `flowchart[${this.data.name}].redraw()`);
    if (xmlGraph !== undefined) {
      this.data.xml = xmlGraph;
      this.xgraph.setXmlGraph(this.getXml(true));
    } else {
      u.log(2, 'XML Content not defined');
      this.xgraph.setXmlGraph(this.getXml(true));
    }
    this.applyOptions();
  }

  reload() {
    u.log(1, `flowchart[${this.data.name}].reload()`);
    if (this.xgraph !== undefined && this.xgraph !== null) {
      this.xgraph.destroyGraph();
      this.xgraph = undefined;
      this.init();
    }
    else this.init();
  }

  setLock(bool) {
    this.data.lock = bool;
    this.xgraph.lock = bool;
  }

  lock(bool) {
    if (bool !== undefined) this.data.lock = bool;
    this.xgraph.lockGraph(this.data.lock);
  }

  setTooltip(bool) {
    this.data.tooltip = bool;
    this.xgraph.tooltip = bool;
  }

  tooltip(bool) {
    if (bool !== undefined) this.data.tooltip = bool;
    this.xgraph.tooltipGraph(this.data.tooltip);
  }

  setScale(bool) {
    this.data.scale = bool;
    this.xgraph.scale = bool;
  }

  setBgColor(bgColor) {
    this.data.bgColor = bgColor;
    this.xgraph.bgColor = bgColor;
  }

  bgColor(bgColor) {
    this.data.bgColor = bgColor;
    if (bgColor) this.xgraph.bgGraph(bgColor);
  }

  scale(bool) {
    u.log(1, 'Flowchart.scale()');
    if (bool !== undefined) this.data.scale = bool;
    this.xgraph.scaleGraph(this.data.scale);
  }

  setCenter(bool) {
    this.data.center = bool;
    this.xgraph.center = bool;
  }

  getNamesByProp(prop) {
    return this.xgraph.getOrignalCells(prop);
  }

  getXml(replaceVarBool) {
    u.log(1, `flowchart[${this.data.name}].getXml()`);
    if (!replaceVarBool) return this.data.xml;
    return this.templateSrv.replaceWithText(this.data.xml);
  }

  getCsv(replaceVarBool) {
    u.log(1, `flowchart[${this.data.name}].getXml()`);
    if (!replaceVarBool) return this.data.csv;
    return this.templateSrv.replaceWithText(this.data.csv);
  }

  getUrlEditor() {
    return this.data.editorUrl;
  }

  getThemeEditor() {
    return this.data.editorTheme;
  }

  /**
   *Get Source of graph (csv|xml) or get content from url
   *
   * @returns
   * @memberof Flowchart
   */
  getContent() {
    u.log(1, `flowchart[${this.data.name}].getContent()`);
    if (this.data.download) {
      let content = this.loadContent(this.data.url);
      if (content !== null) {
        return content;
      } else return '';
    } else {
      if (this.data.type === 'xml') return this.getXml(true);
      if (this.data.type === 'csv') return this.getCsv(true);
    }
  }

  loadContent(url) {
    u.log(1, `flowchart[${this.data.name}].loadContent()`);
    var req = mxUtils.load(url);
    if (req.getStatus() === 200) {
      return req.getText();
    } else {
      u.log(3, 'Cannot load ' + url, req.getStatus());
      return null;
    }
  }

  renameId(oldId, newId) {
    this.xgraph.renameId(oldId, newId);
  }

  applyModel() {
    this.xmlGraph = this.xgraph.getXmlModel();
    this.redraw(this.xmlGraph);
  }

  center(bool) {
    if (bool !== undefined) this.data.center = bool;
    this.xgraph.centerGraph(this.data.center);
  }

  setZoom(percent) {
    this.data.zoom = percent;
    this.xgraph.zoomPercent = percent;
  }

  zoom(percent) {
    if (percent !== undefined) this.data.percent = percent;
    this.xgraph.zoomGraph(this.data.percent);
  }

  setGrid(bool) {
    this.data.grid = bool;
    this.xgraph.grid = bool;
  }

  grid(bool) {
    if (bool !== undefined) this.data.grid = bool;
    this.xgraph.gridGraph(this.data.grid);
  }

  setWidth(width) {
    this.width = width;
  }

  setHeight(height) {
    this.height = height;
  }

  setXml(xml) {
    this.data.xml = xml;
  }

  minify() {
    this.data.xml = u.minify(this.data.xml);
  }

  prettify() {
    this.data.xml = u.prettify(this.data.xml);
  }

  decode() {
    if (u.isencoded(this.data.xml)) this.data.xml = u.decode(this.data.xml, true, true, true);
  }

  encode() {
    if (!u.isencoded(this.data.xml)) this.data.xml = u.encode(this.data.xml, true, true, true);
  }

  getContainer() {
    return this.container;
  }

  setMap(onMappingObj) {
    u.log(1, `flowchart[${this.data.name}].setMap()`);
    const container = this.getContainer();
    this.xgraph.setMap(onMappingObj);
    container.scrollIntoView();
    container.focus();
  }

  unsetMap() {
    this.xgraph.unsetMap();
  }
}
