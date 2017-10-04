import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import alertDef from '../alerting/alert_def';

/** @ngInject **/
export function annotationTooltipDirective($sanitize, dashboardSrv, contextSrv, popoverSrv, $compile) {

  function sanitizeString(str) {
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
      "event": "=",
      "onEdit": "&"
    },
    link: function(scope, element) {
      var event = scope.event;
      var title = event.title;
      var text = event.text;
      var dashboard = dashboardSrv.getCurrent();

      var tooltip = '<div class="graph-annotation">';
      var titleStateClass = '';

      if (event.source.name === 'panel-alert' && event.type !== 'event') {
        var stateModel = alertDef.getStateDisplayModel(event.newState);
        titleStateClass = stateModel.stateClass;
        title = `<i class="icon-gf ${stateModel.iconClass}"></i> ${stateModel.text}`;
        text = alertDef.getAlertAnnotationInfo(event);
      }

      tooltip += `
        <div class="graph-annotation-header">
          <span class="graph-annotation-title ${titleStateClass}">${sanitizeString(title)}</span>
          <span class="graph-annotation-time">${dashboard.formatDate(event.min)}</span>
      `;

      // Show edit icon only for users with at least Editor role
      var userIsEventEditor = contextSrv.isEditor;
      if (event.type === 'event' && userIsEventEditor) {
        tooltip += `
          <span class="pointer graph-annotation-edit-icon" ng-click="onEdit()">
            <i class="fa fa-pencil-square"></i>
          </span>
        `;
      }

      tooltip += `
        </div>
      `;

      tooltip += '<div class="graph-annotation-body">';

      if (text) {
        tooltip += sanitizeString(text).replace(/\n/g, '<br>') + '<br>';
      }

      var tags = event.tags;
      if (_.isString(event.tags)) {
        tags = event.tags.split(',');
        if (tags.length === 1) {
          tags = event.tags.split(' ');
          if (tags[0] === "") {
            tags = [];
          }
        }
      }

      if (tags && tags.length) {
        scope.tags = tags;
        tooltip += '<span class="label label-tag small" ng-repeat="tag in tags" tag-color-from-name="tag">{{tag}}</span><br/>';
      }

      if (event.userName) {
        tooltip += '<div class="graph-annotation-user">User: ' + event.userName + "</div>";
      }

      tooltip += "</div>";

      var $tooltip = $(tooltip);
      $tooltip.appendTo(element);

      $compile(element.contents())(scope);
    }
  };
}



coreModule.directive('annotationTooltip', annotationTooltipDirective);
