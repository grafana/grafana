///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import {coreModule} from 'app/core/core';

var template = `
<span class="panel-title drag-handle">
  <span class="icon-gf panel-alert-icon"></span>
  <span class="panel-title-text drag-handle">{{ctrl.panel.title | interpolateTemplateVars:this}}</span>
  <span class="panel-menu-container dropdown">
    <span class="fa fa-caret-down panel-menu-toggle" data-toggle="dropdown"></span>
    <ul class="dropdown-menu panel-menu" role="menu">
      <li>
        <a ng-click="ctrl.addDataQuery(datasource);">
          <i class="fa fa-cog"></i> Edit <span class="dropdown-menu-item-shortcut">e</span>
        </a>
      </li>
      <li><a ng-click="ctrl.addDataQuery(datasource);"><i class="fa fa-eye"></i> View</a></li>
      <li><a ng-click="ctrl.addDataQuery(datasource);"><i class="fa fa-share-square-o"></i> Share</a></li>
      <li class="dropdown-submenu">
        <a ng-click="ctrl.addDataQuery(datasource);"><i class="fa fa-cube"></i> Actions</a>
        <ul class="dropdown-menu panel-menu">
          <li><a ng-click="ctrl.addDataQuery(datasource);"><i class="fa fa-flash"></i> Add Annotation</a></li>
          <li><a ng-click="ctrl.addDataQuery(datasource);"><i class="fa fa-bullseye"></i> Toggle Legend</a></li>
          <li><a ng-click="ctrl.addDataQuery(datasource);"><i class="fa fa-download"></i> Export to CSV</a></li>
          <li><a ng-click="ctrl.addDataQuery(datasource);"><i class="fa fa-eye"></i> View JSON</a></li>
        </ul>
      </li>
      <li><a ng-click="ctrl.addDataQuery(datasource);"><i class="fa fa-trash"></i> Remove</a></li>
    </ul>
  </span>
  <span class="panel-time-info" ng-show="ctrl.timeInfo"><i class="fa fa-clock-o"></i> {{ctrl.timeInfo}}</span>
</span>`;

/** @ngInject **/
function panelHeader() {
  return {
    restrict: 'E',
    template: template,
    link: function() {
    }
  };
}

coreModule.directive('panelHeader', panelHeader);
