import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { styleMixins, Tooltip, useStyles2 } from '@grafana/ui';
import { AnnotationListItemTags } from './AnnotationListItemTags';
export var AnnotationListItem = function (_a) {
    var options = _a.options, annotation = _a.annotation, formatDate = _a.formatDate, onClick = _a.onClick, onAvatarClick = _a.onAvatarClick, onTagClick = _a.onTagClick;
    var styles = useStyles2(getStyles);
    var showUser = options.showUser, showTags = options.showTags, showTime = options.showTime;
    var text = annotation.text, login = annotation.login, email = annotation.email, avatarUrl = annotation.avatarUrl, tags = annotation.tags, time = annotation.time, timeEnd = annotation.timeEnd;
    var onItemClick = function (e) {
        e.stopPropagation();
        onClick(annotation);
    };
    var onLoginClick = function () {
        onAvatarClick(annotation);
    };
    var showAvatar = login && showUser;
    var showTimeStamp = time && showTime;
    var showTimeStampEnd = timeEnd && timeEnd !== time && showTime;
    return (React.createElement("div", null,
        React.createElement("span", { className: cx(styles.item, styles.link, styles.pointer), onClick: onItemClick },
            React.createElement("div", { className: styles.title },
                React.createElement("span", null, text),
                showTimeStamp ? React.createElement(TimeStamp, { formatDate: formatDate, time: time }) : null,
                showTimeStampEnd ? React.createElement("span", { className: styles.time }, "-") : null,
                showTimeStampEnd ? React.createElement(TimeStamp, { formatDate: formatDate, time: timeEnd }) : null),
            React.createElement("div", { className: styles.login },
                showAvatar ? React.createElement(Avatar, { email: email, login: login, avatarUrl: avatarUrl, onClick: onLoginClick }) : null,
                showTags ? React.createElement(AnnotationListItemTags, { tags: tags, remove: false, onClick: onTagClick }) : null))));
};
var Avatar = function (_a) {
    var onClick = _a.onClick, avatarUrl = _a.avatarUrl, login = _a.login, email = _a.email;
    var styles = useStyles2(getStyles);
    var onAvatarClick = function (e) {
        e.stopPropagation();
        onClick();
    };
    var tooltipContent = (React.createElement("span", null,
        "Created by:",
        React.createElement("br", null),
        " ",
        email));
    return (React.createElement("div", null,
        React.createElement(Tooltip, { content: tooltipContent, theme: "info", placement: "top" },
            React.createElement("span", { onClick: onAvatarClick, className: styles.avatar },
                React.createElement("img", { src: avatarUrl, alt: "avatar icon" })))));
};
var TimeStamp = function (_a) {
    var time = _a.time, formatDate = _a.formatDate;
    var styles = useStyles2(getStyles);
    return (React.createElement("span", { className: styles.time },
        React.createElement("span", null, formatDate(time))));
};
function getStyles(theme) {
    return {
        pointer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      cursor: pointer;\n    "], ["\n      cursor: pointer;\n    "]))),
        item: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin: ", ";\n      padding: ", ";\n      ", "// display: flex;\n    "], ["\n      margin: ", ";\n      padding: ", ";\n      ", "// display: flex;\n    "])), theme.spacing(0.5), theme.spacing(1), styleMixins.listItem(theme)),
        title: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      flex-basis: 80%;\n    "], ["\n      flex-basis: 80%;\n    "]))),
        link: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: flex;\n\n      .fa {\n        padding-top: ", ";\n      }\n\n      .fa-star {\n        color: ", ";\n      }\n    "], ["\n      display: flex;\n\n      .fa {\n        padding-top: ", ";\n      }\n\n      .fa-star {\n        color: ", ";\n      }\n    "])), theme.spacing(0.5), theme.v1.palette.orange),
        login: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      align-self: center;\n      flex: auto;\n      display: flex;\n      justify-content: flex-end;\n      font-size: ", ";\n    "], ["\n      align-self: center;\n      flex: auto;\n      display: flex;\n      justify-content: flex-end;\n      font-size: ", ";\n    "])), theme.typography.bodySmall.fontSize),
        time: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      margin-left: ", ";\n      margin-right: ", "\n      font-size: ", ";\n      color: ", ";\n    "], ["\n      margin-left: ", ";\n      margin-right: ", "\n      font-size: ", ";\n      color: ", ";\n    "])), theme.spacing(1), theme.spacing(1), theme.typography.bodySmall.fontSize, theme.colors.text.secondary),
        avatar: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      padding: ", ";\n      img {\n        border-radius: 50%;\n        width: ", ";\n        height: ", ";\n      }\n    "], ["\n      padding: ", ";\n      img {\n        border-radius: 50%;\n        width: ", ";\n        height: ", ";\n      }\n    "])), theme.spacing(0.5), theme.spacing(2), theme.spacing(2)),
    };
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=AnnotationListItem.js.map