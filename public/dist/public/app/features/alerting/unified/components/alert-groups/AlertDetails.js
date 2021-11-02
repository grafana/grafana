import { __makeTemplateObject, __read } from "tslib";
import { css } from '@emotion/css';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import React from 'react';
import { makeAMLink } from '../../utils/misc';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
import { getMatcherQueryParams } from '../../utils/matchers';
export var AlertDetails = function (_a) {
    var alert = _a.alert, alertManagerSourceName = _a.alertManagerSourceName;
    var styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.actionsRow },
            alert.status.state === AlertState.Suppressed && (React.createElement(LinkButton, { href: makeAMLink('/alerting/silences', alertManagerSourceName) + "&silenceIds=" + alert.status.silencedBy.join(','), className: styles.button, icon: 'bell', size: 'sm' }, "Manage silences")),
            alert.status.state === AlertState.Active && (React.createElement(LinkButton, { href: makeAMLink('/alerting/silence/new', alertManagerSourceName) + "&" + getMatcherQueryParams(alert.labels), className: styles.button, icon: 'bell-slash', size: 'sm' }, "Silence")),
            alert.generatorURL && (React.createElement(LinkButton, { className: styles.button, href: alert.generatorURL, icon: 'chart-line', size: 'sm' }, "See source"))),
        Object.entries(alert.annotations).map(function (_a) {
            var _b = __read(_a, 2), annotationKey = _b[0], annotationValue = _b[1];
            return (React.createElement(AnnotationDetailsField, { key: annotationKey, annotationKey: annotationKey, value: annotationValue }));
        }),
        React.createElement("div", { className: styles.receivers },
            "Receivers:",
            ' ',
            alert.receivers
                .map(function (_a) {
                var name = _a.name;
                return name;
            })
                .filter(function (name) { return !!name; })
                .join(', '))));
};
var getStyles = function (theme) { return ({
    button: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    & + & {\n      margin-left: ", ";\n    }\n  "], ["\n    & + & {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(1)),
    actionsRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    padding: ", " !important;\n    border-bottom: 1px solid ", ";\n  "], ["\n    padding: ", " !important;\n    border-bottom: 1px solid ", ";\n  "])), theme.spacing(2, 0), theme.colors.border.medium),
    receivers: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    padding: ", ";\n  "], ["\n    padding: ", ";\n  "])), theme.spacing(1, 0)),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=AlertDetails.js.map