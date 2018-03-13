/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

import '../css/query.editor.css!';            // eslint-disable-line
import '../directives/ncSpinner.directive';
import '../directives/ncFocus.directive';
import { QueryCtrl } from 'app/plugins/sdk';  // eslint-disable-line
import { datasourceURL } from '../common';

const
  PRIVATE_PROPERTIES = {
    uiSegmentSrv: Symbol('uiSegmentSrv'),
    scope: Symbol('scope'),
    nodeMap: Symbol('nodeMap'),
    nodeSegment: Symbol('nodeSegment'),
    nodeSpinner: Symbol('nodeSpinner'),
    nodeFocus: Symbol('nodeFocus'),
    counterName: Symbol('counterName'),
    counterSpinner: Symbol('counterSpinner'),
    counterFocus: Symbol('counterFocus'),
    counters: Symbol('counters')
  },
  NET_CRUNCH_QUERY_CONTROLLER_DI = ['uiSegmentSrv', '$scope', '$rootScope', '$timeout'],
  DEFAULT_NODE_NAME = 'Select node',
  DEFAULT_COUNTER_DISPLAY_NAME = 'Select counter',
  COUNTERS_SUBMENU_LENGTH = 25;

class NetCrunchQueryController extends QueryCtrl {

  constructor(uiSegmentSrv, $scope, $rootScope, $timeout) {
    super();

    this[PRIVATE_PROPERTIES.uiSegmentSrv] = uiSegmentSrv;
    this[PRIVATE_PROPERTIES.scope] = $scope;
    this[PRIVATE_PROPERTIES.nodeMap] = new Map();
    this[PRIVATE_PROPERTIES.nodeSegment] = this.createDefaultNodeSegment(DEFAULT_NODE_NAME);
    this[PRIVATE_PROPERTIES.nodeSpinner] = false;
    this[PRIVATE_PROPERTIES.nodeFocus] = false;
    this[PRIVATE_PROPERTIES.counterName] = null;
    this[PRIVATE_PROPERTIES.counterSpinner] = false;
    this[PRIVATE_PROPERTIES.counterFocus] = false;
    this[PRIVATE_PROPERTIES.counters] = [];

    this.localVars = Object.create(null);

    this.processingNode = true;
    this.nodeReady = false;
    this.datasource.nodes().then(() => {
      this.processingNode = false;
      this.updateView();
      if (this.target.nodeID != null) {
        this.nodeChanged(this.target.nodeID);
      } else {
        this.nodeFocus = true;
      }
    });

    this.processingCounter = true;
    this.counterReady = false;

    this.showOptions = (this.showOptions == null) ? false : this.showOptions;

    this.target.alias = this.target.alias || '';
    this.target.series = this.target.series || { min: false, avg: true, max: false };

    $rootScope.$on('template-variable-value-updated', () => $timeout(() => this.variableChanged(), 0));
  }

  get localVars() {
    return this.target.localVars;
  }

  set localVars(value) {
    this.target.localVars = value;
  }

  get processingNode() {
    return this.localVars.processingNode;
  }

  set processingNode(value) {
    this.localVars.processingNode = value;
  }

  get nodeSpinner() {
    return this[PRIVATE_PROPERTIES.nodeSpinner];
  }

  get nodeSegment() {
    return this[PRIVATE_PROPERTIES.nodeSegment];
  }

  get nodeFocus() {
    return this[PRIVATE_PROPERTIES.nodeFocus];
  }

  set nodeFocus(value) {
    this[PRIVATE_PROPERTIES.nodeFocus] = value;
  }

  get nodeReady() {
    return this.localVars.nodeReady;
  }

  set nodeReady(value) {
    this.localVars.nodeReady = value;
  }

  get processingCounter() {
    return this.localVars.processingCounter;
  }

  set processingCounter(value) {
    this.localVars.processingCounter = value;
  }

  get defaultCounterName() {              // eslint-disable-line
    return DEFAULT_COUNTER_DISPLAY_NAME;
  }

  get counterSpinner() {
    return this[PRIVATE_PROPERTIES.counterSpinner];
  }

  get counterFocus() {
    return this[PRIVATE_PROPERTIES.counterFocus];
  }

  set counterFocus(value) {
    this[PRIVATE_PROPERTIES.counterFocus] = value;
  }

  get counterReady() {
    return this.localVars.counterReady;
  }

  set counterReady(value) {
    this.localVars.counterReady = value;
  }

  get counterName() {
    return this[PRIVATE_PROPERTIES.counterName];
  }

  get counters() {
    return this[PRIVATE_PROPERTIES.counters];
  }

  get counterDataComplete() {
    return this.target.counterDataComplete;
  }

  set counterDataComplete(value) {
    this.target.counterDataComplete = value;
  }

  get alias() {
    return this.target.alias;
  }

  set alias(value) {
    this.target.alias = value;
  }

  get series() {
    return this.target.series;
  }

  get showOptions() {
    return this.localVars.showOptions;
  }

  set showOptions(value) {
    this.localVars.showOptions = value;
  }

  createDefaultNodeSegment(segmentName) {
    const segment = {
      cssClass: 'nc-reset-segment',
      fake: true,
      type: 'value',
      html: `<div class="nc-default-tile">${segmentName}</div>`,
      value: segmentName
    };
    return this[PRIVATE_PROPERTIES.uiSegmentSrv].newSegment(segment);
  }

  createNodeSegment(node) {

    const nodeSegmentTemplate = `
      <div class="nc-node-tile">
        <img class="nc-node-icon" src=${node.iconUrl}>
        <div class="nc-node-description">
          <span class="nc-node-name">${node.name}</span>
          <span class="nc-node-address">${node.address}</span>
        </div>
      </div>
    `;

    return this[PRIVATE_PROPERTIES.uiSegmentSrv].newSegment({
      cssClass: 'nc-reset-segment',
      fake: true,
      type: 'value',
      html: nodeSegmentTemplate,
      value: NetCrunchQueryController.nodeDisplayValue(node)
    });
  }

  createVariableSegment(variableName) {
    return this[PRIVATE_PROPERTIES.uiSegmentSrv].newSegment({
      cssClass: 'nc-reset-segment',
      expandable: true,
      fake: true,
      type: 'template',
      html: `<div class="nc-default-tile">$${variableName}</div>`,
      value: `$${variableName}`
    });
  }

  targetChanged() {
    this.refresh();
  }

  nodeSpinnerChanged(state) {
    this[PRIVATE_PROPERTIES.nodeSpinner] = state;
  }

  counterSpinnerChanged(state) {
    this[PRIVATE_PROPERTIES.counterSpinner] = state;
  }

  updateView() {
    this[PRIVATE_PROPERTIES.scope].$apply();
  }

  getNodes() {
    const self = this;

    function createVariableSegments() {
      return self.datasource.getNodeVariables()
        .sort((variable1, variable2) => variable1.name.toLocaleString(variable2.name))
        .map(variable => self.createVariableSegment(variable.name));
    }

    function createNodeSegments(nodes) {
      self[PRIVATE_PROPERTIES.nodeMap].clear();
      return nodes.map((node) => {
        const nodeSegment = self.createNodeSegment(node);
        self[PRIVATE_PROPERTIES.nodeMap].set(nodeSegment.value, node);
        return nodeSegment;
      });
    }

    return this.datasource
      .nodes().then(nodes => []
        .concat(createVariableSegments())
        .concat(createNodeSegments(nodes.all)));
  }

  updateCounterList(nodeId = this.target.nodeID) {
    const self = this;

    function setCounterMenu(counterMenu) {
      self.hideCounters = true;
      self.updateView();
      self[PRIVATE_PROPERTIES.counters] = counterMenu;
      self.processingCounter = false;
      self.hideCounters = false;
    }

    function updateSelectedCounter(counterName) {
      self[PRIVATE_PROPERTIES.counterName] = counterName;
      self.counterReady = true;
      self.counterDataComplete = true;
      self.targetChanged();
    }

    function getCounters(nodeId) {               // eslint-disable-line
      return self.datasource.getCounters(nodeId)
        .then((countersByMonitors) => {
          const countersMenu = [];

          Object.keys(countersByMonitors).forEach((monitorId) => {
            if (monitorId > 0) {
              const
                subMenu = countersByMonitors[monitorId]
                  .counters.map(counter => ({
                    text: counter.displayName,
                    value: counter.name
                  })),
                subMenuPartsCount = Math.ceil(subMenu.length / COUNTERS_SUBMENU_LENGTH);

              for (let i = 0; i < subMenuPartsCount; i += 1) {
                const
                  startIndex = i * COUNTERS_SUBMENU_LENGTH,
                  stopIndex = Math.min((i + 1) * COUNTERS_SUBMENU_LENGTH, subMenu.length),
                  subMenuNameExtension = (subMenuPartsCount > 1) ? ` [${startIndex + 1}..${stopIndex}]` : '',
                  subMenuName = `${countersByMonitors[monitorId].name}${subMenuNameExtension}`;

                countersMenu.push({
                  text: subMenuName,
                  submenu: subMenu.slice(startIndex, stopIndex)
                });
              }
            }
          });

          return {
            countersMenu,
            countersTable: countersByMonitors.table
          };
        });
    }

    this.processingCounter = true;
    this.counterReady = false;
    this.counterDataComplete = false;
    this.updateView();

    getCounters(nodeId)
      .then((counters) => {
        setCounterMenu(counters.countersMenu);
        if (counters.countersTable.some(counter => (counter.name === this.target.counterName))) {
          updateSelectedCounter(this.target.counterName);
        } else {
          this.targetChanged();
          this.counterFocus = true;
        }
      });
  }

  nodeChanged(nodeId = null) {
    const self = this;

    function isNodeTemplate(nodeId) {            // eslint-disable-line
      return self.datasource.isNodeTemplate(nodeId);
    }

    function nodeNotReady() {
      self.nodeReady = false;
      self.processingCounter = true;
      self.counterReady = false;
      self.counterDataComplete = false;
    }

    function setNodeSegment(nodeId) {            // eslint-disable-line

      if (isNodeTemplate(nodeId)) {
        Object.assign(self[PRIVATE_PROPERTIES.nodeSegment], self.createVariableSegment(nodeId.slice(1)));
        self.updateView();
        return Promise.resolve();
      }

      return self.datasource
        .nodes().then((nodes) => {
          const node = nodes.all.find(nodeItem => (nodeItem.id === nodeId));
          Object.assign(self[PRIVATE_PROPERTIES.nodeSegment], self.createNodeSegment(node));
          self.updateView();
        });
    }

    function getSelectedNode(nodeId) {           // eslint-disable-line

      if (nodeId != null) {
        if (isNodeTemplate(nodeId)) {
          return Promise.resolve(nodeId);
        }
        return self.datasource
          .nodes()
          .then(nodes => ((nodes.all.some(node => (nodeId === node.id))) ? nodeId : null));
      } else if (isNodeTemplate(self.nodeSegment.value)) {
        return Promise.resolve(self.nodeSegment.value);
      } else if (self[PRIVATE_PROPERTIES.nodeMap].has(self.nodeSegment.value)) {
        return Promise.resolve(self[PRIVATE_PROPERTIES.nodeMap].get(self.nodeSegment.value).id);
      }

      return Promise.resolve(null);
    }

    getSelectedNode(nodeId).then((selectedNodeId) => {
      this.target.nodeID = selectedNodeId;

      if (selectedNodeId == null) {
        nodeNotReady();
        Object.assign(this[PRIVATE_PROPERTIES.nodeSegment], this.createDefaultNodeSegment(DEFAULT_NODE_NAME));
        this.targetChanged();
      } else {
        const nodeSegmentReady = (nodeId != null) ? setNodeSegment(nodeId) : Promise.resolve();

        this.nodeReady = true;
        this.processingCounter = true;
        this.counterReady = false;
        this.updateView();

        nodeSegmentReady
          .then(() => self.updateCounterList(selectedNodeId));
      }
    });
  }

  counterChanged(counter) {
    this[PRIVATE_PROPERTIES.counterName] = counter.value;
    this.target.counterName = counter.value;
    this.counterDataComplete = true;
    this.targetChanged();
  }

  toggleShowOptions() {
    this.showOptions = !this.showOptions;
  }

  variableChanged() {
    this.updateCounterList();
  }

  static nodeDisplayValue(node) {
    if ((node.name != null) && (node.name !== '')) {
      return `${node.name}${(((node.address != null) && (node.address !== '')) ? ` (${node.address})` : '')}`;
    } else if ((node.address != null) && (node.address !== '')) {
      return node.address;
    }
    return '';
  }

  static get templateUrl() {
    return `${datasourceURL}query/query.editor.html`;
  }

  static set templateUrl(value) {   // eslint-disable-line
  }

}

NetCrunchQueryController.$inject = NET_CRUNCH_QUERY_CONTROLLER_DI;

export {
  NetCrunchQueryController
};
