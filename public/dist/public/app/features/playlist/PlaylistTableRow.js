import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Icon, IconButton, useStyles } from '@grafana/ui';
import { TagBadge } from '../../core/components/TagFilter/TagBadge';
import { selectors } from '@grafana/e2e-selectors';
export var PlaylistTableRow = function (_a) {
    var item = _a.item, onDelete = _a.onDelete, onMoveDown = _a.onMoveDown, onMoveUp = _a.onMoveUp, first = _a.first, last = _a.last;
    var styles = useStyles(getStyles);
    var onDeleteClick = function (event) {
        event.preventDefault();
        onDelete(item);
    };
    var onMoveDownClick = function (event) {
        event.preventDefault();
        onMoveDown(item);
    };
    var onMoveUpClick = function (event) {
        event.preventDefault();
        onMoveUp(item);
    };
    return (React.createElement("tr", { "aria-label": selectors.pages.PlaylistForm.itemRow, key: item.title },
        item.type === 'dashboard_by_id' ? (React.createElement("td", { className: cx(styles.td, styles.item) },
            React.createElement(Icon, { name: "apps", "aria-label": selectors.pages.PlaylistForm.itemIdType }),
            React.createElement("span", null, item.title))) : null,
        item.type === 'dashboard_by_tag' ? (React.createElement("td", { className: cx(styles.td, styles.item) },
            React.createElement(Icon, { name: "tag-alt", "aria-label": selectors.pages.PlaylistForm.itemTagType }),
            React.createElement(TagBadge, { key: item.id, label: item.title, removeIcon: false, count: 0 }))) : null,
        React.createElement("td", { className: cx(styles.td, styles.settings) },
            !first ? (React.createElement(IconButton, { name: "arrow-up", size: "md", onClick: onMoveUpClick, "aria-label": selectors.pages.PlaylistForm.itemMoveUp, type: "button" })) : null,
            !last ? (React.createElement(IconButton, { name: "arrow-down", size: "md", onClick: onMoveDownClick, "aria-label": selectors.pages.PlaylistForm.itemMoveDown, type: "button" })) : null,
            React.createElement(IconButton, { name: "times", size: "md", onClick: onDeleteClick, "aria-label": selectors.pages.PlaylistForm.itemDelete, type: "button" }))));
};
function getStyles(theme) {
    return {
        td: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: td;\n      line-height: 28px;\n      max-width: 335px;\n      white-space: nowrap;\n      text-overflow: ellipsis;\n      overflow: hidden;\n    "], ["\n      label: td;\n      line-height: 28px;\n      max-width: 335px;\n      white-space: nowrap;\n      text-overflow: ellipsis;\n      overflow: hidden;\n    "]))),
        item: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: item;\n      span {\n        margin-left: ", ";\n      }\n    "], ["\n      label: item;\n      span {\n        margin-left: ", ";\n      }\n    "])), theme.spacing.xs),
        settings: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: settings;\n      text-align: right;\n    "], ["\n      label: settings;\n      text-align: right;\n    "]))),
    };
}
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=PlaylistTableRow.js.map