import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import alertDef from '../alerting/state/alertDef';
/** @ngInject */
export function annotationTooltipDirective($sanitize, dashboardSrv, contextSrv, $compile) {
    function sanitizeString(str) {
        try {
            return $sanitize(str);
        }
        catch (err) {
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
        link: function (scope, element) {
            var event = scope.event;
            var title = event.title;
            var text = event.text;
            var dashboard = dashboardSrv.getCurrent();
            var tooltip = '<div class="graph-annotation">';
            var titleStateClass = '';
            if (event.alertId) {
                var stateModel = alertDef.getStateDisplayModel(event.newState);
                titleStateClass = stateModel.stateClass;
                title = "<i class=\"" + stateModel.iconClass + "\"></i> " + stateModel.text;
                text = alertDef.getAlertAnnotationInfo(event);
                if (event.text) {
                    text = text + '<br />' + event.text;
                }
            }
            else if (title) {
                text = title + '<br />' + (_.isString(text) ? text : '');
                title = '';
            }
            var header = "<div class=\"graph-annotation__header\">";
            if (event.login) {
                header += "<div class=\"graph-annotation__user\" bs-tooltip=\"'Created by " + event.login + "'\"><img src=\"" + event.avatarUrl + "\" /></div>";
            }
            header += "\n          <span class=\"graph-annotation__title " + titleStateClass + "\">" + sanitizeString(title) + "</span>\n          <span class=\"graph-annotation__time\">" + dashboard.formatDate(event.min) + "</span>\n      ";
            // Show edit icon only for users with at least Editor role
            if (event.id && dashboard.meta.canEdit) {
                header += "\n          <span class=\"pointer graph-annotation__edit-icon\" ng-click=\"onEdit()\">\n            <i class=\"fa fa-pencil-square\"></i>\n          </span>\n        ";
            }
            header += "</div>";
            tooltip += header;
            tooltip += '<div class="graph-annotation__body">';
            if (text) {
                tooltip += '<div>' + sanitizeString(text.replace(/\n/g, '<br>')) + '</div>';
            }
            var tags = event.tags;
            if (tags && tags.length) {
                scope.tags = tags;
                tooltip +=
                    '<span class="label label-tag small" ng-repeat="tag in tags" tag-color-from-name="tag">{{tag}}</span><br/>';
            }
            tooltip += '</div>';
            tooltip += '</div>';
            var $tooltip = $(tooltip);
            $tooltip.appendTo(element);
            $compile(element.contents())(scope);
        },
    };
}
coreModule.directive('annotationTooltip', annotationTooltipDirective);
//# sourceMappingURL=annotation_tooltip.js.map