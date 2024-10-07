/* eslint-disable prefer-destructuring */
import Flowchart from './flowchart_class';

/**
 * Class FlowchartHandler
 */
export default class FlowchartHandler {
  /**
   *Creates an instance of FlowchartHandler to handle flowchart
   * @param {*} $scope - angular scope
   * @param {*} elem - angular elem
   * @param {*} ctrl - ctrlPanel
   * @param {*} data - Empty data to store
   * @memberof FlowchartHandler
   */
  constructor($scope, elem, ctrl, data) {
    u.log(1, 'FlowchartHandler.constructor()');
    u.log(0, 'FlowchartHandler.constructor() data', data);
    this.$scope = $scope || null;
    this.$elem = elem.find('.flowchart-panel__chart');
    this.ctrl = ctrl;
    this.flowcharts = [];
    this.data = data;
    this.firstLoad = true;
    this.changeSourceFlag = false;
    this.changeOptionFlag = true;
    this.changeDataFlag = false;
    this.changedRuleFlag = false;
    this.defaultXml = '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';
    this.xgraph = undefined;
    this.$container = undefined;
    this.onMapping = {
      active: false, // boolean if pointer mapping is active
      object: undefined, // ojb to return id of mapping
      id: undefined // id of dom
    };

    this.import(this.data);

    // Events Render
    ctrl.events.on('render', () => {
      this.render();
    });

    this.mousedownTimeout = 0;
    this.mousedown = 0;

    document.body.onmousedown = () => {
      this.mousedown = 0;
      window.clearInterval(this.mousedownTimeout);
      this.mousedownTimeout = window.setInterval(() => {
        this.mousedown += 1;
      }, 200);
    };

    document.body.onmouseup = () => {
      this.mousedown = 0;
      window.clearInterval(this.mousedownTimeout);
    };
  }

  /**
   * import data into
   *
   * @param {Object} obj
   * @memberof FlowchartHandler
   */
  import(obj) {
    u.log(1, 'FlowchartHandler.import()');
    u.log(0, 'FlowchartHandler.import() obj', obj);
    this.flowcharts = [];
    if (obj !== undefined && obj !== null && obj.length > 0) {
      obj.forEach(map => {
        const container = this.createContainer();
        const newData = {};
        const fc = new Flowchart(map.name, map.xml, container, this.ctrl, newData);
        fc.import(map);
        this.flowcharts.push(fc);
        this.data.push(newData);
      });
    }
  }

  /**
   * Get flowchart in index position
   *
   * @param {Number} index
   * @returns {Flowchart}
   * @memberof FlowchartHandler
   */
  getFlowchart(index) {
    return this.flowcharts[index];
  }

  /**
   * Return array of flowchart
   *
   * @returns {Array} Array of flowchart
   * @memberof FlowchartHandler
   */
  getFlowcharts() {
    return this.flowcharts;
  }

  /**
   *Return number of flowchart
   *
   * @returns {number} Nulber of flowchart
   * @memberof FlowchartHandler
   */
  countFlowcharts() {
    if (this.flowcharts !== undefined && Array.isArray(this.flowcharts))
      return this.flowcharts.length;
    return 0;
  }

  /**
   *Create a div container for graph
   *
   * @returns {DOM}
   * @memberof FlowchartHandler
   */
  createContainer() {
    const $container = $(
      `<div id="flowchart_${u.uniqueID}" style="margin:auto;position:relative,width:100%;height:100%"></div>`
    );
    this.$elem.html($container);
    return $container[0];
  }

  /**
   *Add a flowchart
   *
   * @param {string} name
   * @memberof FlowchartHandler
   */
  addFlowchart(name) {
    u.log(1, 'FlowchartHandler.addFlowchart()');
    const container = this.createContainer();
    const data = {};
    const flowchart = new Flowchart(name, this.defaultXml, container, this.ctrl, data);
    this.data.push(data);
    this.flowcharts.push(flowchart);
  }

  /**
   *Render for draw
   *
   * @memberof FlowchartHandler
   */
  render() {
    u.log(1, 'flowchartHandler.render()');
    // not repeat render if mouse down
    this.optionsFlag = true;
    if (!this.mousedown) {
      // SOURCE
      if (this.changeSourceFlag) {
        this.load();
        this.changeSourceFlag = false;
        this.changeRuleFlag = true;
        this.optionsFlag = true;
      }
      // OPTIONS
      if (this.changeOptionFlag) {
        this.setOptions();
        this.changeOptionFlag = false;
        this.optionsFlag = true;
      }
      // RULES or DATAS
      if (this.changeRuleFlag || this.changeDataFlag) {
        const rules = this.ctrl.rulesHandler.getRules();
        const series = this.ctrl.series;

        // if (this.changeRuleFlag) {
        //   this.updateStates(rules);
        //   this.changeRuleFlag = false;
        // }
        // this.setStates(rules, series);
        // this.applyStates();

        // Change to async to optimize
        this.async_refreshStates(rules,series);
        this.changeDataFlag = false;
        this.optionsFlag = false;
      }

      // OTHER : Resize, OnLoad
      if (this.optionsFlag || this.firstLoad) {
        this.applyOptions();
        this.optionsFlag = false;
        this.firstLoad = false;
      }
    }
  }

  /**
   *Flag source change
   *
   * @memberof FlowchartHandler
   */
  sourceChanged() {
    this.changeSourceFlag = true;
  }

  /**
   *Flag options change
   *
   * @memberof FlowchartHandler
   */
  optionChanged() {
    this.changeOptionFlag = true;
  }

  /**
   *Flag rule change
   *
   * @memberof FlowchartHandler
   */
  ruleChanged() {
    this.changeRuleFlag = true;
  }

  /**
   *Flag data change
   *
   * @memberof FlowchartHandler
   */
  dataChanged() {
    this.changeDataFlag = true;
  }

  /**
   *Refresh flowchart then graph
   *
   * @memberof FlowchartHandler
   */
  applyOptions() {
    u.log(1, `FlowchartHandler.applyOptions()`);
    this.flowcharts.forEach(flowchart => {
      flowchart.applyOptions();
    });
  }

  /**
   *Call refreshStates asynchronously
   *
   * @param {*} rules
   * @param {*} series
   * @memberof FlowchartHandler
   */
  async_refreshStates(rules,series) {
    this.refreshStates(rules,series);
  }

  /**
   *Refresh rules according new rules or data
   *
   * @param {*} rules
   * @param {*} series
   * @memberof FlowchartHandler
   */
  refreshStates(rules,series) {
    if (this.changeRuleFlag) {
      this.updateStates(rules);
      this.changeRuleFlag = false;
    }
    this.setStates(rules, series);
    this.applyStates();
  }

  refresh() {
    this.flowcharts.forEach(flowchart => {
      flowchart.refresh();
    });
  }

  /**
   * Change states of cell according to rules and series
   *
   * @memberof FlowchartHandler
   */
  setStates(rules, series) {
    this.flowcharts.forEach(flowchart => {
      flowchart.setStates(rules, series);
    });
  }

  updateStates(rules) {
    this.flowcharts.forEach(flowchart => {
      flowchart.updateStates(rules);
    });
  }

  /**
   * Apply state of cell after setStates
   *
   * @memberof FlowchartHandler
   */
  applyStates() {
    this.flowcharts.forEach(flowchart => {
      flowchart.applyStates();
    });
    this.refresh();
  }

  /**
   *Apply and set options
   *
   * @memberof FlowchartHandler
   */
  setOptions() {
    this.flowcharts.forEach(flowchart => {
      flowchart.setOptions();
    });
  }

  /**
   *(re)draw graph
   *
   * @memberof FlowchartHandler
   */
  draw() {
    u.log(1, `FlowchartHandler.draw()`);
    this.flowcharts.forEach(flowchart => {
      flowchart.redraw();
    });
  }

  /**
   *(re)load graph
   *
   * @memberof FlowchartHandler
   */
  load() {
    u.log(1, `FlowchartHandler.load()`);
    this.flowcharts.forEach(flowchart => {
      flowchart.reload();
    });
  }

  /**
   *Active option link/map
   *
   * @param {Object} objToMap
   * @memberof FlowchartHandler
   */
  setMap(objToMap) {
    const flowchart = this.getFlowchart(0);
    this.onMapping.active = true;
    this.onMapping.object = objToMap;
    this.onMapping.id = objToMap.getId();
    this.onMapping.$scope = this.$scope;
    flowchart.setMap(this.onMapping);
  }

  /**
   *Desactivate option
   *
   * @memberof FlowchartHandler
   */
  unsetMap() {
    const flowchart = this.getFlowchart(0);
    this.onMapping.active = false;
    this.onMapping.object = undefined;
    this.onMapping.id = '';
    flowchart.unsetMap();
  }

  /**
   *Return true if mapping object is active
   *
   * @param {properties} objToMap
   * @returns true - true if mapping mode
   * @memberof FlowchartHandler
   */
  isMapping(objToMap) {
    if (objToMap === undefined || objToMap == null) return this.onMapping.active;
    if (this.onMapping.active === true && objToMap === this.onMapping.object) return true;
    return false;
  }

  listenMessage(event) {
    // if (event.origin !== urlEditor) return;
    // when editor is open
    let index = this.currentFlowchartIndex;
    if (event.data === 'ready') {
      // send xml
      event.source.postMessage(this.flowcharts[index].data.xml, event.origin);
    } else {
      if (this.onEdit && event.data !== undefined && event.data.length > 0) {
        this.flowcharts[index].redraw(event.data);
        this.sourceChanged();
        this.$scope.$apply();
        this.render();
      }
      if ((this.onEdit && event.data !== undefined) || event.data.length === 0) {
        this.editorWindow.close();
        this.onEdit = false;
        window.removeEventListener('message', this.listenMessage.bind(this), false);
      }
    }
  }

  /**
   *Open graph in draw.io
   *
   * @param {number} index - index of flowchart
   * @memberof FlowchartHandler
   */
  openDrawEditor(index) {
    const urlEditor = this.getFlowchart(index).getUrlEditor();
    this.currentFlowchartIndex = index;
    const theme = this.getFlowchart(index).getThemeEditor();
    const urlParams = `${urlEditor}?embed=1&spin=1&libraries=1&ui=${theme}`;
    this.editorWindow = window.open(urlParams, 'MxGraph Editor', 'width=1280, height=720');
    this.onEdit = true;
    window.addEventListener('message', this.listenMessage.bind(this), false);
  }
}
