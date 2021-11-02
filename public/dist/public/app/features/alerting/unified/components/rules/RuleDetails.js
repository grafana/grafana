import { __makeTemplateObject, __read } from "tslib";
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertLabels } from '../AlertLabels';
import { DetailsField } from '../DetailsField';
import { RuleDetailsActionButtons } from './RuleDetailsActionButtons';
import { RuleDetailsDataSources } from './RuleDetailsDataSources';
import { RuleDetailsMatchingInstances } from './RuleDetailsMatchingInstances';
import { RuleDetailsExpression } from './RuleDetailsExpression';
import { RuleDetailsAnnotations } from './RuleDetailsAnnotations';
export var RuleDetails = function (_a) {
    var rule = _a.rule;
    var styles = useStyles2(getStyles);
    var promRule = rule.promRule, rulesSource = rule.namespace.rulesSource;
    var annotations = Object.entries(rule.annotations).filter(function (_a) {
        var _b = __read(_a, 2), _ = _b[0], value = _b[1];
        return !!value.trim();
    });
    return (React.createElement("div", null,
        React.createElement(RuleDetailsActionButtons, { rule: rule, rulesSource: rulesSource }),
        React.createElement("div", { className: styles.wrapper },
            React.createElement("div", { className: styles.leftSide },
                !!rule.labels && !!Object.keys(rule.labels).length && (React.createElement(DetailsField, { label: "Labels", horizontal: true },
                    React.createElement(AlertLabels, { labels: rule.labels }))),
                React.createElement(RuleDetailsExpression, { rulesSource: rulesSource, rule: rule, annotations: annotations }),
                React.createElement(RuleDetailsAnnotations, { annotations: annotations })),
            React.createElement("div", { className: styles.rightSide },
                React.createElement(RuleDetailsDataSources, { rulesSource: rulesSource, rule: rule }))),
        React.createElement(RuleDetailsMatchingInstances, { promRule: promRule })));
};
export var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    ", " {\n      flex-direction: column;\n    }\n  "], ["\n    display: flex;\n    flex-direction: row;\n    ", " {\n      flex-direction: column;\n    }\n  "])), theme.breakpoints.down('md')),
    leftSide: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    flex: 1;\n  "], ["\n    flex: 1;\n  "]))),
    rightSide: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    ", " {\n      padding-left: 90px;\n      width: 300px;\n    }\n  "], ["\n    ", " {\n      padding-left: 90px;\n      width: 300px;\n    }\n  "])), theme.breakpoints.up('md')),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=RuleDetails.js.map