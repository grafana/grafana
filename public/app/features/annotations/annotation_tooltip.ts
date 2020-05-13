import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import alertDef from '../alerting/state/alertDef';
import { DashboardSrv } from '../dashboard/services/DashboardSrv';
import { ContextSrv } from 'app/core/services/context_srv';

/** @ngInject */
export function annotationTooltipDirective(
  $sanitize: any,
  dashboardSrv: DashboardSrv,
  contextSrv: ContextSrv,
  $compile: any
) {
  function sanitizeString(str: string) {
    try {
      return $sanitize(str);
    } catch (err) {
      console.log('Could not sanitize annotation string, html escaping instead');
      return _.escape(str);
    }
  }

  return {
    restrict: 'E',
    scope: {
      event: '=',
      onEdit: '&',
    },
    link: (scope: any, element: JQuery) => {
      const event = scope.event;
      let title = event.title;
      let text = event.text;
      const dashboard = dashboardSrv.getCurrent();

      let tooltip = '<div class="graph-annotation">';
      let titleStateClass = '';

      if (event.alertId) {
        const stateModel = alertDef.getStateDisplayModel(event.newState);
        titleStateClass = stateModel.stateClass;
        title = `<i class="${stateModel.iconClass}"></i> ${stateModel.text}`;
        text = alertDef.getAlertAnnotationInfo(event);
        if (event.text) {
          text = text + '<br />' + event.text;
        }
      } else if (title) {
        text = title + '<br />' + (_.isString(text) ? text : '');
        title = '';
      }

      let header = `<div class="graph-annotation__header">`;
      if (event.login) {
        header += `<div class="graph-annotation__user" bs-tooltip="'Created by ${event.login}'"><img src="${event.avatarUrl}" /></div>`;
      }
      header += `
          <span class="graph-annotation__title ${titleStateClass}">${sanitizeString(title)}</span>
          <span class="graph-annotation__time">${dashboard.formatDate(event.min)}</span>
      `;

      // Show edit icon only for users with at least Editor role
      if (event.id && dashboard.meta.canEdit) {
        header += `
          <span class="pointer graph-annotation__edit-icon" ng-click="onEdit()">
            <i class="fa fa-pencil-square"></i>
          </span>
        `;
      }

      header += `</div>`;
      tooltip += header;
      tooltip += '<div class="graph-annotation__body">';

      if (text) {
        tooltip += '<div ng-non-bindable>' + sanitizeString(text.replace(/\n/g, '<br>')) + '</div>';
      }

      const tags = event.tags;

      if (tags && tags.length) {
        scope.tags = tags;
        tooltip +=
          '<span class="label label-tag small" ng-repeat="tag in tags" tag-color-from-name="tag">{{tag}}</span><br/>';
      }

      tooltip += '</div>';
      tooltip += '</div>';

      const $tooltip = $(tooltip);
      $tooltip.appendTo(element);

      $compile(element.contents())(scope);
    },
  };
}

coreModule.directive('annotationTooltip', annotationTooltipDirective);
