import { resolve } from 'path';

/* eslint-disable no-undef */
/* eslint-disable new-cap */
/* eslint-disable dot-notation */
/* eslint-disable object-shorthand */
window.mxLanguages = window.mxLanguages || ['en'];

require('./libs/sanitizer.min');
const mxgraph = require('mxgraph')({
  mxImageBasePath: GF_PLUGIN.getMxImagePath(),
  mxBasePath: GF_PLUGIN.getMxBasePath(),
  mxLoadStylesheets: false,
  mxLanguage: 'en',
  mxLoadResources: false
});

const Chartist = require('chartist');

window.BASE_PATH = window.BASE_PATH || GF_PLUGIN.getMxBasePath();
window.RESOURCES_PATH = window.BASE_PATH || `${window.BASE_PATH}resources`;
window.RESOURCE_BASE = window.RESOURCE_BASE || `${window.RESOURCES_PATH}/grapheditor`;
window.STENCIL_PATH = window.STENCIL_PATH || `${window.BASE_PATH}stencils`;
window.SHAPES_PATH = window.SHAPES_PATH || GF_PLUGIN.getShapesPath();
window.IMAGE_PATH = window.IMAGE_PATH || `${window.BASE_PATH}images`;
window.STYLE_PATH = window.STYLE_PATH || `${window.BASE_PATH}styles`;
window.CSS_PATH = window.CSS_PATH || `${window.BASE_PATH}styles`;
window.mxLanguages = window.mxLanguages || ['en'];

// Put to global vars to work
window.mxActor = window.mxActor || mxgraph.mxActor;
window.mxArrow = window.mxArrow || mxgraph.mxArrow;
window.mxArrowConnector = window.mxArrowConnector || mxgraph.mxArrowConnector;
window.mxCell = window.mxCell || mxgraph.mxCell;
window.mxCellEditor = window.mxCellEditor || mxgraph.mxCellEditor;
window.mxCellHighlight = window.mxCellHighlight || mxgraph.mxCellHighlight;
window.mxCellOverlay = window.mxCellOverlay || mxgraph.mxCellOverlay;
window.mxCellRenderer = window.mxCellRenderer || mxgraph.mxCellRenderer;
window.mxCellState = window.mxCellState || mxgraph.mxCellState;
window.mxClient = window.mxClient || mxgraph.mxClient;
mxClient.mxBasePath = GF_PLUGIN.getMxBasePath();
mxClient.mxImageBasePath = GF_PLUGIN.getMxImagePath();
mxClient.mxLoadResources = true;
mxClient.mxLanguage = 'en';
mxClient.mxLoadStylesheets = true;
window.mxCloud = window.mxCloud || mxgraph.mxCloud;
window.mxCodec = window.mxCodec || mxgraph.mxCodec;
window.mxCompactTreeLayout = window.mxCompactTreeLayout || mxgraph.mxCompactTreeLayout;
window.mxConnectionConstraint = window.mxConnectionConstraint || mxgraph.mxConnectionConstraint;
window.mxConnectionHandler = window.mxConnectionHandler || mxgraph.mxConnectionHandler;
window.mxConnector = window.mxConnector || mxgraph.mxConnector;
window.mxConstants = window.mxConstants || mxgraph.mxConstants;
window.mxConstraintHandler = window.mxConstraintHandler || mxgraph.mxConstraintHandler;
window.mxCylinder = window.mxCylinder || mxgraph.mxCylinder;
window.mxDefaultKeyHandler = window.mxDefaultKeyHandler || mxgraph.mxDefaultKeyHandler;
window.mxDefaultPopupMenu = window.mxDefaultPopupMenu || mxgraph.mxDefaultPopupMenu;
window.mxDefaultToolbar = window.mxDefaultToolbar || mxgraph.mxDefaultToolbar;
window.mxDivResizer = window.mxDivResizer || mxgraph.mxDivResizer;
window.mxDoubleEllipse = window.mxDoubleEllipse || mxgraph.mxDoubleEllipse;
window.mxDragSource = window.mxDragSource || mxgraph.mxDragSource;
window.mxEdgeStyle = window.mxEdgeStyle || mxgraph.mxEdgeStyle;
window.mxEdgeHandler = window.mxEdgeHandler || mxgraph.mxEdgeHandler;
window.mxEditor = window.mxEditor || mxgraph.mxEditor;
window.mxElbowEdgeHandler = window.mxElbowEdgeHandler || mxgraph.mxElbowEdgeHandler;
window.mxEllipse = window.mxEllipse || mxgraph.mxEllipse;
window.mxEvent = window.mxEvent || mxgraph.mxEvent;
window.mxEventObject = window.mxEventObject || mxgraph.mxEventObject;
window.mxFile = window.mxFile || mxgraph.mxFile;
window.mxGeometry = window.mxGeometry || mxgraph.mxGeometry;
window.mxGraph = window.mxGraph || mxgraph.mxGraph;
window.mxGraphHandler = window.mxGraphHandler || mxgraph.mxGraphHandler;
window.mxGraphModel = window.mxGraphModel || mxgraph.mxGraphModel;
window.mxGraphView = window.mxGraphView || mxgraph.mxGraphView;
window.mxGuide = window.mxGuide || mxgraph.mxGuide;
window.mxHexagon = window.mxHexagon || mxgraph.mxHexagon;
window.mxHandle = window.mxHandle || mxgraph.mxHandle;
window.mxHierarchicalLayout = window.mxHierarchicalLayout || mxgraph.mxHierarchicalLayout;
window.mxImage = window.mxImage || mxgraph.mxImage;
window.mxImageShape = window.mxImageShape || mxgraph.mxImageShape;
window.mxKeyHandler = window.mxKeyHandler || mxgraph.mxKeyHandler;
window.mxLabel = window.mxLabel || mxgraph.mxLabel;
window.mxLayoutManager = window.mxLayoutManager || mxgraph.mxLayoutManager;
window.mxLine = window.mxLine || mxgraph.mxLine;
window.mxMarker = window.mxMarker || mxgraph.mxMarker;
window.mxOutline = window.mxOutline || mxgraph.mxOutline;
window.mxPanningHandler = window.mxPanningHandler || mxgraph.mxPanningHandler;
window.mxPerimeter = window.mxPerimeter || mxgraph.mxPerimeter;
window.mxPoint = window.mxPoint || mxgraph.mxPoint;
window.mxPolyline = window.mxPolyline || mxgraph.mxPolyline;
window.mxPopupMenu = window.mxPopupMenu || mxgraph.mxPopupMenu;
window.mxPopupMenuHandler = window.mxPopupMenuHandler || mxgraph.mxPopupMenuHandler;
window.mxPrintPreview = window.mxPrintPreview || mxgraph.mxPrintPreview;
window.mxRectangle = window.mxRectangle || mxgraph.mxRectangle;
window.mxRectangleShape = window.mxRectangleShape || mxgraph.mxRectangleShape;
window.mxResources = window.mxResources || mxgraph.mxResources;
window.mxRhombus = window.mxRhombus || mxgraph.mxRhombus;
window.mxRubberband = window.mxRubberband || mxgraph.mxRubberband;
window.mxShape = window.mxShape || mxgraph.mxShape;
window.mxStackLayout = window.mxStackLayout || mxgraph.mxStackLayout;
window.mxStencil = window.mxStencil || mxgraph.mxStencil;
window.mxStencilRegistry = window.mxStencilRegistry || mxgraph.mxStencilRegistry;
window.mxStylesheet = window.mxStylesheet || mxgraph.mxStylesheet;
window.mxStyleRegistry = window.mxStyleRegistry || mxgraph.mxStyleRegistry;
window.mxSvgCanvas2D = window.mxSvgCanvas2D || mxgraph.mxSvgCanvas2D;
window.mxSwimlane = window.mxSwimlane || mxgraph.mxSwimlane;
window.mxText = window.mxText || mxgraph.mxText;
window.mxToolbar = window.mxToolbar || mxgraph.mxToolbar;
window.mxTooltip = window.mxTooltip || mxgraph.mxTooltip;
window.mxTooltipHandler = window.mxTooltipHandler || mxgraph.mxTooltipHandler;
window.mxTriangle = window.mxTriangle || mxgraph.mxTriangle;
window.mxUndoManager = window.mxUndoManager || mxgraph.mxUndoManager;
window.mxUrlConverter = window.mxUrlConverter || mxgraph.mxUrlConverter;
window.mxUtils = window.mxUtils || mxgraph.mxUtils;
window.mxValueChange = window.mxValueChange || mxgraph.mxValueChange;
window.mxVertexHandler = window.mxVertexHandler || mxgraph.mxVertexHandler;

// Extends mxGraph
require('./Shapes');
const Graph = require('./Graph')({
  libs: 'arrows;basic;bpmn;flowchart'
});
Graph.handleFactory = mxGraph.handleFactory;
Graph.createHandle = mxGraph.createHandle;
// Specifics function for Flowcharting
require('./Graph_over');
window.Graph = window.Graph || Graph;

/**
 *mxGraph interface class
 *
 * @export
 * @class XGraph
 */
export default class XGraph {
  /**
   *Creates an instance of XGraph.
   * @param {DOM} container
   * @param {string} definition
   * @memberof XGraph
   */
  constructor(container, type, definition) {
    u.log(1, 'XGraph.constructor()');
    this.container = container;
    this.xmlGraph = undefined;
    this.type = type;
    this.graph = undefined;
    this.scale = true;
    this.tooltip = true;
    this.lock = true;
    this.center = true;
    this.zoom = false;
    // BEGIN ZOOM MouseWheele
    this.zoomFactor = 1.2;
    this.cumulativeZoomFactor = 1;
    this.updateZoomTimeout = null;
    this.resize = null;
    // END ZOOM MouseWheele
    this.grid = false;
    this.bgColor = undefined;
    this.zoomPercent = '1';
    this.cells = {};
    this.cells.id = [];
    this.cells.value = [];
    this.cells.attributs = {};
    this.clickBackup = undefined;
    if (type === 'xml') {
      if (u.isencoded(definition)) this.xmlGraph = u.decode(definition, true, true, true);
      else this.xmlGraph = definition;
    }

    this.initGraph();
  }

  /**
   *Graph initilisation and reset
   *
   * @memberof XGraph
   */
  initGraph() {
    u.log(1, 'XGraph.initGraph()');
    this.graph = new Graph(this.container);
    this.graph.getTooltipForCell = this.getTooltipForCell;

    // /!\ What is setPannig
    this.graph.setPanning(true);

    // Backup funtions of clicks
    this.clickBackup = this.graph.click;
    this.dbclickBackup = this.graph.dblClick;

    // EVENTS

    // CTRL+MOUSEWHEEL
    mxEvent.addMouseWheelListener(mxUtils.bind(this, this.eventMouseWheel), this.container);
    if (mxClient.IS_IE || mxClient.IS_EDGE)
      mxEvent.addListener(this.container, 'wheel', mxUtils.bind(this, this.eventMouseWheel));

    // KEYS
    mxEvent.addListener(document, 'keydown', mxUtils.bind(this, this.eventKey));

    // CONTEXT MENU
    this.container.addEventListener('contextmenu', e => e.preventDefault());

    // DB CLICK
    this.graph.dblClick = this.eventDbClick.bind(this);
  }

  /**
   *Draw graph
   *
   * @memberof XGraph
   */
  drawGraph() {
    u.log(1, 'XGraph.drawGraph()');
    this.graph.getModel().beginUpdate();
    this.graph.getModel().clear();
    try {
      const xmlDoc = mxUtils.parseXml(this.xmlGraph);
      const codec = new mxCodec(xmlDoc);
      codec.decode(xmlDoc.documentElement, this.graph.getModel());
    } catch (error) {
      u.log(3, 'Error in draw', error);
    } finally {
      this.graph.getModel().endUpdate();
      this.cells['id'] = this.getCurrentCells('id');
      this.cells['value'] = this.getCurrentCells('value');
    }
  }

  /**
   *apply options on graph
   *
   * @param {*} width
   * @param {*} height
   * @memberof XGraph
   */
  applyGraph() {
    u.log(1, 'XGraph.refreshGraph()');
    if (!this.scale) this.zoomGraph(this.zoomPercent);
    else this.unzoomGraph();
    this.tooltipGraph(this.tooltip);
    this.lockGraph(this.lock);
    if (this.scale && this.center) this.fitGraph();
    else {
      this.scaleGraph(this.scale);
      this.centerGraph(this.center);
    }
    this.gridGraph(this.grid);
    this.bgGraph(this.bgColor);
    this.refresh();
  }

  refresh() {
    this.graph.refresh();
  }

  destroyGraph() {
    this.graph.destroy();
    this.graph = undefined;
  }

  /**
   *lock cells
   *
   * @param {Boolean} bool
   * @memberof XGraph
   */
  lockGraph(bool) {
    if (bool) this.graph.setEnabled(false);
    else this.graph.setEnabled(true);
    this.lock = bool;
  }

  /**
   *Enable tooltip
   *
   * @param {Boolean} bool
   * @memberof XGraph
   */
  tooltipGraph(bool) {
    if (bool) this.graph.setTooltips(true);
    else this.graph.setTooltips(false);
    this.tooltip = bool;
  }

  allowDrawio(bool) {
    if (bool) {
      mxUrlConverter.prototype.baseUrl = 'http://draw.io/';
      mxUrlConverter.prototype.baseDomain = '';
    } else {
      mxUrlConverter.prototype.baseUrl = null;
      mxUrlConverter.prototype.baseDomain = null;
    }
  }

  /**
   *Center graph in panel
   *
   * @param {Boolean} bool
   * @memberof XGraph
   */
  centerGraph(bool) {
    this.graph.centerZoom = false;
    if (bool) this.graph.center(true, true);
    else this.graph.center(false, false);
    this.center = bool;
  }

  /**
   *Scale graph in panel
   *
   * @param {Boolean} bool
   * @memberof XGraph
   */
  scaleGraph(bool) {
    if (bool) {
      this.unzoomGraph();
      this.graph.fit();
      this.graph.view.rendering = true;
    }
    this.scale = bool;
  }

  fitGraph() {
    var margin = 2;
    var max = 3;

    var bounds = this.graph.getGraphBounds();
    var cw = this.graph.container.clientWidth - margin;
    var ch = this.graph.container.clientHeight - margin;
    var w = bounds.width / this.graph.view.scale;
    var h = bounds.height / this.graph.view.scale;
    var s = Math.min(max, Math.min(cw / w, ch / h));

    this.graph.view.scaleAndTranslate(
      s,
      (margin + cw - w * s) / (2 * s) - bounds.x / this.graph.view.scale,
      (margin + ch - h * s) / (2 * s) - bounds.y / this.graph.view.scale
    );
  }

  /**
   *Display grid in panel
   *
   * @param {Boolean} bool
   * @memberof XGraph
   */
  gridGraph(bool) {
    if (bool) {
      // eslint-disable-next-line no-undef
      this.container.style.backgroundImage = `url('${IMAGE_PATH}/grid.gif')`;
    } else {
      this.container.style.backgroundImage = '';
    }
    this.grid = bool;
  }

  /**
   *Zoom/unzoom
   *
   * @param {string} percent
   * @memberof XGraph
   */
  zoomGraph(percent) {
    u.log(1, 'XGraph.zoomGraph()');
    if (!this.scale && percent && percent.length > 0 && percent !== '100%' && percent !== '0%') {
      const ratio = percent.replace('%', '') / 100;
      this.graph.zoomTo(ratio, true);
      this.zoomPercent = percent;
    } else {
      this.unzoomGraph();
    }
    this.zoom = true;
  }

  /**
   *Restore initial size
   *
   * @memberof XGraph
   */
  unzoomGraph() {
    this.zoom = false;
    this.graph.zoomActual();
  }

  /**
   *Define background color
   *
   * @param {string} bgColor
   * @memberof XGraph
   */
  bgGraph(bgColor) {
    const $div = $(this.container);
    if (bgColor) {
      this.bgColor = bgColor;
      $div.css('background-color', bgColor);
    } else {
      $div.css('background-color', '');
    }
  }

  /**
   *Return mxgraph object
   *
   * @returns {mxGraph}
   * @memberof XGraph
   */
  getMxGraph() {
    return this.graph;
  }

  /**
   *Return xml definition
   *
   * @returns {string}
   * @memberof XGraph
   */
  getxmlGraph() {
    return this.xmlGraph;
  }

  /**
   *Assign xml definition and redraw graph
   *
   * @param {string} xmlGraph
   * @memberof XGraph
   */
  setXmlGraph(xmlGraph) {
    u.log(1, 'XGraph.setXmlGraph()');
    if (u.isencoded(xmlGraph)) this.xmlGraph = u.decode(xmlGraph, true, true, true);
    else this.xmlGraph = xmlGraph;
    this.drawGraph();
  }

  /**
   *Get list of values or id
   *
   * @param {string} prop - id|value
   * @returns {Array<string>}
   * @memberof XGraph
   */
  getCurrentCells(prop) {
    const cellIds = [];
    const model = this.graph.getModel();
    const cells = model.cells;
    if (prop === 'id') {
      _.each(cells, cell => {
        cellIds.push(cell.getId());
      });
    } else if (prop === 'value') {
      _.each(cells, cell => {
        cellIds.push(cell.getValue());
      });
    }
    return cellIds;
  }

  /**
   *Get list of mxCell
   *
   * @param {string} prop - id|value
   * @param {string} pattern - regex like or string
   * @returns {Array<mxCell>}
   * @memberof XGraph
   */
  findMxCells(prop, pattern) {
    const mxcells = this.getMxCells();
    const result = [];
    if (prop === 'id') {
      _.each(mxcells, mxcell => {
        if (u.matchString(mxcell.id, pattern)) result.push(mxcell);
      });
    } else if (prop === 'value') {
      _.each(mxcells, mxcell => {
        if (u.matchString(mxcell.getValue(), pattern)) result.push(mxcell);
      });
    }
    return result;
  }

  /**
   *Select cells in graph with pattern for id or value
   *
   * @param {string} prop - "id"|"value"
   * @param {string} pattern - regex like
   * @memberof XGraph
   */
  selectMxCells(prop, pattern) {
    const mxcells = this.findMxCells(prop, pattern);
    if (mxcells) {
      // this.graph.setSelectionCells(mxcells);
      this.highlightCells(mxcells);
    }
  }

  /**
   *Unselect cells
   *
   * @memberof XGraph
   */
  unselectMxCells(prop, pattern) {
    const mxcells = this.findMxCells(prop, pattern);
    if (mxcells) {
      this.unhighlightCells(mxcells);
    }
  }

  /**
   *Create tooltip on image
   *
   * @param {*} image
   * @param {*} tooltip
   * @returns
   * @memberof XGraph
   */
  createOverlay(image, tooltip) {
    const overlay = new mxCellOverlay(image, tooltip);
    overlay.addListener(mxEvent.CLICK, (_sender, _evt) => {
      mxUtils.alert(`${tooltip}\nLast update: ${new Date()}`);
    });
    return overlay;
  }

  /**
   *Add Warning icon
   *
   * @param {string} state (OK|WARN|ERROR)
   * @param {mxCell} mxcell
   * @memberof XGraph
   */
  addOverlay(state, mxcell) {
    this.graph.addCellOverlay(
      mxcell,
      this.createOverlay(this.graph.warningImage, `State: ${state}`)
    );
  }

  /**
   *Remove Warning icon
   *
   * @param {mxCell} mxcell
   * @memberof XGraph
   */
  removeOverlay(mxcell) {
    this.graph.removeCellOverlays(mxcell);
  }

  /**
   *Add link to cell
   *
   * @param {mxCell} mxcell
   * @param {string} link - Url
   * @memberof XGraph
   */
  addLink(mxcell, link) {
    this.graph.setLinkForCell(mxcell, link);
  }

  /**
   *Get link from cell
   *
   * @param {*} mxcell
   * @memberof XGraph
   */
  getLink(mxcell) {
    this.graph.getLinkForCell(mxcell);
  }

  /**
   *Remove link of cell
   *
   * @param {mxCell} mxcell
   * @memberof XGraph
   */
  removeLink(mxcell) {
    this.graph.setLinkForCell(mxcell, null);
  }

  /**
   *Get value or id from cell source
   *
   * @param {*} prop
   * @returns
   * @memberof XGraph
   */
  getOrignalCells(prop) {
    if (prop === 'id' || prop === 'value') return this.cells[prop];
    // TODO: attributs
    return [];
  }

  /**
   *Rename Id of cell
   *Must be uniq
   *
   * @param {string} oldId
   * @param {string} newId
   * @memberof XGraph
   */
  renameId(oldId, newId) {
    const cells = this.findMxCells('id', oldId);
    if (cells !== undefined && cells.length > 0) {
      cells.forEach(cell => {
        cell.id = newId;
      });
    } else {
      u.log(2, `Cell ${oldId} not found`);
    }
  }

  /**
   *Get xml definition from current graph
   *
   * @returns
   * @memberof XGraph
   */
  getXmlModel() {
    const encoder = new mxCodec();
    const node = encoder.encode(this.graph.getModel());
    return mxUtils.getXml(node);
  }

  /**
   *Find and return current cell with matching pattern for id or value
   *
   * @param {string} prop - "id"|"value"
   * @param {string} pattern - regex
   * @returns {Array} strings of id
   * @memberof XGraph
   */
  // NOT USED
  // findCurrentCells(prop, pattern) {
  //   const cells = this.getCurrentCells(prop);
  //   const result = _.find(cells, cell => {
  //     u.matchString(cell, pattern);
  //   });
  //   return result;
  // }

  /**
   *Find and return original cell with matching pattern for id or value
   *
   * @param {string} prop - "id"|"value"
   * @param {string} pattern - regex
   * @returns {Array} strings of id
   * @memberof XGraph
   */
  // NOT USED
  // findOriginalCells(prop, pattern) {
  //   const cells = this.getOrignalCells(prop);
  //   const result = _.find(cells, cell => {
  //     u.matchString(cell, pattern);
  //   });
  //   return result;
  // }

  /**
   *Return all cells
   *
   * @returns {array} mxCells
   * @memberof XGraph
   */
  getMxCells() {
    return this.graph.getModel().cells;
  }

  /**
   * Return value of id or value of mxcell
   *
   * @param {string} prop - "id"|"value"
   * @param {mxCell} mxcell
   * @memberof XGraph
   */
  getValuePropOfMxCell(prop, mxcell) {
    if (prop === 'id') return this.getId(mxcell);
    if (prop === 'value') return this.getLabel(mxcell);
    return null;
  }

  // NOT USED
  // findCurrentMxCells(prop, pattern) {
  //   const cells = [];
  //   _.each(this.getMxCells(), mxcell => {
  //     if (prop === 'id') {
  //       const id = mxcell.getId();
  //       if (u.matchString(id, pattern)) cells.push(mxcell);
  //     } else if (prop === 'value') {
  //       const value = this.getLabel(mxcell);
  //       if (u.matchString(value, pattern)) cells.push(mxcell);
  //     }
  //   });
  //   return cells;
  // }

  getStyleCell(mxcell, style) {
    const state = this.graph.view.getState(mxcell);
    if (state) return state.style[style];
    return null;
  }

  setStyleCell(mxcell, style, color) {
    this.graph.setCellStyles(style, color, [mxcell]);
  }

  // eslint-disable-next-line class-methods-use-this
  /**
   *Return Label/value of mxcell
   *
   * @param {mxCell} mxcell
   * @returns
   * @memberof XGraph
   */
  getLabel(mxcell) {
    if (mxUtils.isNode(mxcell.value)) {
      return mxcell.value.getAttribute('label');
    }
    return mxcell.getValue(mxcell);
  }

  /**
   *Return Id of mxCell
   *
   * @param {mxCell} mxcell
   * @returns {string} Id of mxCell
   * @memberof XGraph
   */
  getId(mxcell) {
    return mxcell.getId();
  }

  // eslint-disable-next-line class-methods-use-this
  /**
   *Assign new label for mxcell
   *
   * @param {*} mxcell
   * @param {string} text - New label
   * @returns {string} New label
   * @memberof XGraph
   */
  setLabelCell(mxcell, text) {
    if (mxUtils.isNode(mxcell.value)) {
      var label = mxcell.value.setAttribute('label', text);
    } else mxcell.setValue(text);
    return text;
  }

  /**
   *Active mapping option when user click on mapping
   *
   * @param {Object} onMappingObj
   * @memberof XGraph
   */
  setMap(onMappingObj) {
    u.log(1, 'XGraph.setMapping()');
    u.log(0, 'XGraph.setMapping() onMappingObject : ', onMappingObj);
    this.onMapping = onMappingObj;
    if (this.onMapping.active === true) {
      this.container.style.cursor = 'crosshair';
      this.graph.click = this.eventClick.bind(this);
    }
  }

  /**
   *Disable mapping when user click on mapping
   *
   * @memberof XGraph
   */
  unsetMap() {
    u.log(1, 'XGraph.unsetMapping()');
    this.onMapping.active = false;
    this.container.style.cursor = 'auto';
    this.graph.click = this.clickBackup;
    this.onMapping.$scope.$apply();
  }

  //
  // GRAPH HANDLER
  //

  /**
   *Event for click on graph
   *
   * @param {MouseEvent} me
   * @memberof XGraph
   */
  eventClick(me) {
    u.log(1, 'XGraph.eventClick()');
    const self = this;

    if (this.onMapping.active) {
      const state = me.getState();
      if (state) {
        const id = state.cell.id;
        this.onMapping.object.data.pattern = id;
        const elt = document.getElementById(this.onMapping.id);
        if (elt) {
          setTimeout(() => {
            elt.focus();
          }, 100);
        }
        this.unsetMap();
      }
    }
  }

  /**
   *Event for double click on graph
   *
   * @param {Event} evt
   * @param {mxCell} mxcell
   * @memberof XGraph
   */
  eventDbClick(evt, mxcell) {
    u.log(1, 'XGraph.eventDbClick()');
    u.log(0, 'XGraph.eventDbClick() evt', evt);
    u.log(0, 'XGraph.eventDbClick() cell', mxcell);
    u.log(
      1,
      'XGraph.eventDbClick() container.getBoundingClientRect()',
      this.container.getBoundingClientRect()
    );
    if (mxcell !== undefined) {
      this.lazyZoomCell(mxcell);
    }
  }

  /**
   *Event for mouse wheel on graph
   *
   * @param {Event} evt
   * @param {boolean} up
   * @memberof XGraph
   */
  eventMouseWheel(evt, up) {
    u.log(1, 'XGraph.eventMouseWheel()');
    u.log(0, 'XGraph.eventMouseWheel() evt', evt);
    u.log(0, 'XGraph.eventMouseWheel() up', up);
    if (this.graph.isZoomWheelEvent(evt)) {
      if (up == null || up == undefined) {
        u.log(0, 'XGraph.eventMouseWheel() up', 'Not defined');
        if (evt.deltaY < 0) up = true;
        else up = false;
      }
      // const rect = evt.target.getBoundingClientRect();
      // let offsetLeft = (evt.currentTarget.offsetLeft != undefined ? evt.currentTarget.offsetLeft : 0 );
      // let offsetTop = (evt.currentTarget.offsetTop != undefined ? evt.currentTarget.offsetTop : 0 )
      // u.log(0, 'XGraph.eventMouseWheel() offsetLeft', offsetLeft);
      // u.log(0, 'XGraph.eventMouseWheel() offsetTop', offsetTop);
      // var x = evt.layerX - offsetLeft;
      // var y = evt.layerY - offsetTop;
      var x = evt.layerX;
      var y = evt.layerY;
      if (up) {
        this.cumulativeZoomFactor = this.cumulativeZoomFactor * 1.2;
      } else {
        this.cumulativeZoomFactor = this.cumulativeZoomFactor * 0.8;
      }
      this.lazyZoomPointer(this.cumulativeZoomFactor, x, y);
      mxEvent.consume(evt);
    }
  }

  /**
   *Event for key on graph
   *
   * @param {Event} evt
   * @memberof XGraph
   */
  eventKey(evt) {
    if (!mxEvent.isConsumed(evt) && evt.keyCode == 27 /* Escape */) {
      this.cumulativeZoomFactor = 1;
      if (this.graph) {
        this.graph.zoomActual();
        this.applyGraph(this.width, this.height);
      }
    }
  }

  /**
   *Zoom/Unzoom on graph on center
   *
   * @param {number} factor - 1 = 100%
   * @memberof XGraph
   */
  lazyZoomCenter(factor) {
    this.graph.zoomTo(factor, true);
  }

  /**
   *Zoom/Unzoom on graph on mouse pointer
   *
   * @param {number} factor
   * @param {number} offsetX
   * @param {number} offsetY
   * @memberof XGraph
   */
  lazyZoomPointer(factor, offsetX, offsetY) {
    u.log(1, 'XGraph.lazyZoomPointer()');
    u.log(0, 'XGraph.lazyZoomPointer() factor', factor);
    u.log(0, 'XGraph.lazyZoomPointer() offsetX', offsetX);
    u.log(0, 'XGraph.lazyZoomPointer() offsetY', offsetY);
    let dx = offsetX * 2;
    let dy = offsetY * 2;

    factor = Math.max(0.01, Math.min(this.graph.view.scale * factor, 160)) / this.graph.view.scale;
    factor = this.cumulativeZoomFactor / this.graph.view.scale;
    let scale = Math.round(this.graph.view.scale * factor * 100) / 100;
    factor = scale / this.graph.view.scale;

    if (factor > 1) {
      var f = (factor - 1) / (scale * 2);
      dx *= -f;
      dy *= -f;
    } else {
      var f = (1 / factor - 1) / (this.graph.view.scale * 2);
      dx *= f;
      dy *= f;
    }

    this.graph.view.scaleAndTranslate(
      scale,
      this.graph.view.translate.x + dx,
      this.graph.view.translate.y + dy
    );
  }

  /**
   * Highlights the given cell.
   */
  highlightCells(cells) {
    for (var i = 0; i < cells.length; i++) {
      this.highlightCell(cells[i]);
    }
  }

  /**
   * UnHighlights the given array of cells.
   */
  unhighlightCells(cells) {
    for (var i = 0; i < cells.length; i++) {
      this.unhighlightCell(cells[i]);
    }
  }

  /**
   * Highlights the given cell.
   */
  // highlightCell(cell, color, duration, opacity)
  highlightCell(cell) {
    if (cell.highlight) return;
    let color = '#99ff33';
    // color = (color != null) ? color : mxConstants.DEFAULT_VALID_COLOR;
    // duration = (duration != null) ? duration : 1000;
    let opacity = 100;
    var state = this.graph.view.getState(cell);

    if (state != null) {
      var sw = Math.max(5, mxUtils.getValue(state.style, mxConstants.STYLE_STROKEWIDTH, 1) + 4);
      var hl = new mxCellHighlight(this.graph, color, sw, false);

      if (opacity != null) {
        hl.opacity = opacity;
      }

      hl.highlight(state);
      cell.highlight = hl;
    }
  }

  /**
   *UnHighlights the given cell.
   *
   * @param {*} cell
   * @memberof XGraph
   */
  unhighlightCell(cell) {
    if (cell && cell.highlight) {
      let hl = cell.highlight;
      // Fades out the highlight after a duration
      if (hl.shape != null) {
        mxUtils.setPrefixedStyle(hl.shape.node.style, 'transition', 'all 500ms ease-in-out');
        hl.shape.node.style.opacity = 0;
      }

      // Destroys the highlight after the fade
      window.setTimeout(function() {
        hl.destroy();
      }, 500);
      cell.highlight = null;
    }
  }

  /**
   *Zoom cell on full panel
   *
   * @param {*} mxcell
   * @memberof XGraph
   */
  lazyZoomCell(mxcell) {
    u.log(1, 'XGraph.lazyZoomCell() mxcell', mxcell);
    u.log(0, 'XGraph.lazyZoomCell() mxcellState', this.graph.view.getState(mxcell));
    if (mxcell !== undefined && mxcell !== null && mxcell.isVertex()) {
      const state = this.graph.view.getState(mxcell);
      if (state !== null) {
        const x = state.x;
        const y = state.y;
        const width = state.width;
        const height = state.height;
        const rect = new mxRectangle(x, y, width, height);
        this.graph.zoomToRect(rect);
        this.cumulativeZoomFactor = this.graph.view.scale;
      }
    }
  }

  toggleVisible(mxcell, includeEdges) {
    this.graph.toggleCells(!this.graph.getModel().isVisible(mxcell), [mxcell], includeEdges);
  }

  getTooltipForCell(cell) {
    u.log(1, 'Graph.prototype.getTooltipForCell()');
    let hasTips = false;
    let div = document.createElement('div');
    if (mxUtils.isNode(cell.value)) {
      let tmp = cell.value.getAttribute('tooltip');
      // Tooltip
      if (tmp != null) {
        hasTips = true;
        if (tmp != null && this.isReplacePlaceholders(cell)) {
          tmp = this.replacePlaceholders(cell, tmp);
        }
        let ttDiv = document.createElement('div');
        ttDiv.className = 'tooltip-text';
        ttDiv.innerHTML = this.sanitizeHtml(tmp);
        div.appendChild(ttDiv);
      }

      let ignored = this.builtInProperties;
      let attrs = cell.value.attributes;
      let temp = [];

      // Hides links in edit mode
      // if (this.isEnabled()) {
      ignored.push('link');
      // }

      // Attributes
      for (var i = 0; i < attrs.length; i++) {
        if (mxUtils.indexOf(ignored, attrs[i].nodeName) < 0 && attrs[i].nodeValue.length > 0) {
          temp.push({ name: attrs[i].nodeName, value: attrs[i].nodeValue });
        }
      }

      // Sorts by name
      temp.sort(function(a, b) {
        if (a.name < b.name) {
          return -1;
        } else if (a.name > b.name) {
          return 1;
        } else {
          return 0;
        }
      });
      if (temp.length > 0) {
        hasTips = true;
        var attrDiv = document.createElement('div');
        var attrString = '';
        for (var i = 0; i < temp.length; i++) {
          if (temp[i].name != 'link' || !this.isCustomLink(temp[i].value)) {
            attrString +=
              (temp[i].name != 'link' ? '<b>' + temp[i].name + ':</b> ' : '') +
              mxUtils.htmlEntities(temp[i].value) +
              '\n';
          }
        }
        attrDiv.innerHTML = attrString;
        div.appendChild(attrDiv);
      }
    }

    // GF Tooltips
    if (cell.GF_tooltipHandler != null) {
      let tooltipHandler = cell.GF_tooltipHandler;
      let gfDiv = tooltipHandler.getTooltipDiv(div);
      if (gfDiv !== null) {
        hasTips = true;
      }
    }
    // let divs = this.getTooltipGFs(cell);
    // if (divs !== null) {
    //   hasTips = true;
    //   div.appendChild(divs);
    // }

    if (hasTips) return div;
    return '';
  }

}
