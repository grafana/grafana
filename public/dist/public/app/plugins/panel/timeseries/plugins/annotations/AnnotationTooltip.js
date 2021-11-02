import { __makeTemplateObject } from "tslib";
import React from 'react';
import { HorizontalGroup, IconButton, Tag, useStyles2 } from '@grafana/ui';
import { textUtil } from '@grafana/data';
import alertDef from 'app/features/alerting/state/alertDef';
import { css } from '@emotion/css';
export var AnnotationTooltip = function (_a) {
    var annotation = _a.annotation, timeFormatter = _a.timeFormatter, editable = _a.editable, onEdit = _a.onEdit, onDelete = _a.onDelete;
    var styles = useStyles2(getStyles);
    var time = timeFormatter(annotation.time);
    var timeEnd = timeFormatter(annotation.timeEnd);
    var text = annotation.text;
    var tags = annotation.tags;
    var alertText = '';
    var avatar;
    var editControls;
    var state = null;
    var ts = React.createElement("span", { className: styles.time }, Boolean(annotation.isRegion) ? time + " - " + timeEnd : time);
    if (annotation.login && annotation.avatarUrl) {
        avatar = React.createElement("img", { className: styles.avatar, src: annotation.avatarUrl });
    }
    if (annotation.alertId !== undefined && annotation.newState) {
        var stateModel = alertDef.getStateDisplayModel(annotation.newState);
        state = (React.createElement("div", { className: styles.alertState },
            React.createElement("i", { className: stateModel.stateClass }, stateModel.text)));
        alertText = alertDef.getAlertAnnotationInfo(annotation);
    }
    else if (annotation.title) {
        text = annotation.title + '<br />' + (typeof text === 'string' ? text : '');
    }
    if (editable) {
        editControls = (React.createElement("div", { className: styles.editControls },
            React.createElement(IconButton, { name: 'pen', size: 'sm', onClick: onEdit }),
            React.createElement(IconButton, { name: 'trash-alt', size: 'sm', onClick: onDelete })));
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.header },
            React.createElement(HorizontalGroup, { justify: 'space-between', align: 'center', spacing: 'md' },
                React.createElement("div", { className: styles.meta },
                    React.createElement("span", null,
                        avatar,
                        state),
                    ts),
                editControls)),
        React.createElement("div", { className: styles.body },
            text && React.createElement("div", { dangerouslySetInnerHTML: { __html: textUtil.sanitize(text) } }),
            alertText,
            React.createElement(React.Fragment, null,
                React.createElement(HorizontalGroup, { spacing: "xs", wrap: true }, tags === null || tags === void 0 ? void 0 : tags.map(function (t, i) { return (React.createElement(Tag, { name: t, key: t + "-" + i })); }))))));
};
AnnotationTooltip.displayName = 'AnnotationTooltip';
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      max-width: 400px;\n    "], ["\n      max-width: 400px;\n    "]))),
        header: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding: ", ";\n      border-bottom: 1px solid ", ";\n      font-size: ", ";\n      display: flex;\n    "], ["\n      padding: ", ";\n      border-bottom: 1px solid ", ";\n      font-size: ", ";\n      display: flex;\n    "])), theme.spacing(0.5, 1), theme.colors.border.weak, theme.typography.bodySmall.fontSize),
        meta: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n    "], ["\n      display: flex;\n      justify-content: space-between;\n    "]))),
        editControls: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      > :last-child {\n        margin-right: 0;\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      > :last-child {\n        margin-right: 0;\n      }\n    "]))),
        avatar: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      border-radius: 50%;\n      width: 16px;\n      height: 16px;\n      margin-right: ", ";\n    "], ["\n      border-radius: 50%;\n      width: 16px;\n      height: 16px;\n      margin-right: ", ";\n    "])), theme.spacing(1)),
        alertState: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      padding-right: ", ";\n      font-weight: ", ";\n    "], ["\n      padding-right: ", ";\n      font-weight: ", ";\n    "])), theme.spacing(1), theme.typography.fontWeightMedium),
        time: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      color: ", ";\n      font-weight: normal;\n      display: inline-block;\n      position: relative;\n      top: 1px;\n    "], ["\n      color: ", ";\n      font-weight: normal;\n      display: inline-block;\n      position: relative;\n      top: 1px;\n    "])), theme.colors.text.secondary),
        body: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      padding: ", ";\n\n      a {\n        color: ", ";\n        &:hover {\n          text-decoration: underline;\n        }\n      }\n    "], ["\n      padding: ", ";\n\n      a {\n        color: ", ";\n        &:hover {\n          text-decoration: underline;\n        }\n      }\n    "])), theme.spacing(1), theme.colors.text.link),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=AnnotationTooltip.js.map