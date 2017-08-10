///<reference path="../../headers/common.d.ts" />

import $ from 'jquery';
import angular from 'angular';
import {coreModule} from 'app/core/core';

var template = `
<span class="panel-title">
  <span class="icon-gf panel-alert-icon"></span>
  <span class="panel-title-text">{{ctrl.panel.title | interpolateTemplateVars:this}}</span>
  <span class="panel-menu-container dropdown">
    <span class="fa fa-caret-down panel-menu-toggle" data-toggle="dropdown"></span>
    <ul class="dropdown-menu dropdown-menu--menu panel-menu" role="menu">
      <li>
        <a ng-click="ctrl.addDataQuery(datasource);">
          <i class="fa fa-cog"></i> Edit <span class="dropdown-menu-item-shortcut">e</span>
        </a>
      </li>
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

function renderMenuItem(item, ctrl) {
  let html = '';
  let listItemClass = '';

  if (item.divider) {
    return '<li class="divider"></li>';
  }

  if (item.submenu) {
    listItemClass = 'dropdown-submenu';
  }

  html += `<li class="${listItemClass}"><a `;

  if (item.click) { html += ` ng-click="${item.click}"`; }
  if (item.href) { html += ` href="${item.href}"`; }

  html += `><i class="${item.icon}"></i>`;
  html += `<span class="dropdown-item-text">${item.text}</span>`;

  if (item.shortcut) {
    html += `<span class="dropdown-menu-item-shortcut">${item.shortcut}</span>`;
  }

  html += `</a>`;

  if (item.submenu) {
    html += '<ul class="dropdown-menu dropdown-menu--menu panel-menu">';
    for (let subitem of item.submenu) {
      html += renderMenuItem(subitem, ctrl);
    }
    html += '</ul>';
  }

  html += `</li>`;
  return html;
}

function createMenuTemplate(ctrl) {
  let html = '';

  for (let item of ctrl.getMenu()) {
    html += renderMenuItem(item, ctrl);
  }

  return html;
}

/** @ngInject **/
function panelHeader($compile) {
  return {
    restrict: 'E',
    template: template,
    link: function(scope, elem, attrs) {

      let menuElem = elem.find('.panel-menu');
      let menuScope;

      elem.click(function(evt) {
        const targetClass = evt.target.className;

        // remove existing scope
        if (menuScope) {
          menuScope.$destroy();
        }

        menuScope = scope.$new();
        let menuHtml = createMenuTemplate(scope.ctrl);
        menuElem.html(menuHtml);
        $compile(menuElem)(menuScope);

        if (targetClass === 'panel-title-text' || targetClass === 'panel-title') {
          evt.stopPropagation();
          elem.find('[data-toggle=dropdown]').dropdown('toggle');
        }
      });
    }
  };
}

coreModule.directive('panelHeader', panelHeader);
