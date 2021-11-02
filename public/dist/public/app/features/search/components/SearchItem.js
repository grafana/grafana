import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { css } from '@emotion/css';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { TagList, Card, Icon, useStyles2 } from '@grafana/ui';
import { SearchCheckbox } from './SearchCheckbox';
import { SEARCH_ITEM_HEIGHT } from '../constants';
var selectors = e2eSelectors.pages.Dashboards;
var getIconFromMeta = function (meta) {
    if (meta === void 0) { meta = ''; }
    var metaIconMap = new Map([
        ['errors', 'info-circle'],
        ['views', 'eye'],
    ]);
    return metaIconMap.has(meta) ? metaIconMap.get(meta) : 'sort-amount-down';
};
export var SearchItem = function (_a) {
    var item = _a.item, editable = _a.editable, onToggleChecked = _a.onToggleChecked, onTagSelected = _a.onTagSelected;
    var styles = useStyles2(getStyles);
    var tagSelected = useCallback(function (tag, event) {
        onTagSelected(tag);
    }, [onTagSelected]);
    var handleCheckboxClick = useCallback(function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        if (onToggleChecked) {
            onToggleChecked(item);
        }
    }, [item, onToggleChecked]);
    var folderTitle = item.folderTitle || 'General';
    return (React.createElement(Card, { "aria-label": selectors.dashboards(item.title), heading: item.title, href: item.url, style: { minHeight: SEARCH_ITEM_HEIGHT }, className: styles.container },
        React.createElement(Card.Figure, { align: 'center', className: styles.checkbox },
            React.createElement(SearchCheckbox, { "aria-label": "Select dashboard", editable: editable, checked: item.checked, onClick: handleCheckboxClick })),
        React.createElement(Card.Meta, { separator: '' },
            React.createElement("span", { className: styles.metaContainer },
                React.createElement(Icon, { name: 'folder' }),
                folderTitle),
            item.sortMetaName && (React.createElement("span", { className: styles.metaContainer },
                React.createElement(Icon, { name: getIconFromMeta(item.sortMetaName) }),
                item.sortMeta,
                " ",
                item.sortMetaName))),
        React.createElement(Card.Tags, null,
            React.createElement(TagList, { tags: item.tags, onClick: tagSelected }))));
};
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n\n      a {\n        padding: ", " ", ";\n      }\n    "], ["\n      margin-bottom: ", ";\n\n      a {\n        padding: ", " ", ";\n      }\n    "])), theme.spacing(0.75), theme.spacing(1), theme.spacing(2)),
        metaContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      margin-right: ", ";\n\n      svg {\n        margin-right: ", ";\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      margin-right: ", ";\n\n      svg {\n        margin-right: ", ";\n      }\n    "])), theme.spacing(1), theme.spacing(0.5)),
        checkbox: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-right: 0;\n    "], ["\n      margin-right: 0;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=SearchItem.js.map