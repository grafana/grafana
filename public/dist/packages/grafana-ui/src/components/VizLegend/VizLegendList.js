import { __makeTemplateObject } from "tslib";
import React from 'react';
import { InlineList } from '../List/InlineList';
import { List } from '../List/List';
import { css, cx } from '@emotion/css';
import { useStyles } from '../../themes';
import { VizLegendListItem } from './VizLegendListItem';
/**
 * @internal
 */
export var VizLegendList = function (_a) {
    var items = _a.items, itemRenderer = _a.itemRenderer, onLabelMouseEnter = _a.onLabelMouseEnter, onLabelMouseOut = _a.onLabelMouseOut, onLabelClick = _a.onLabelClick, placement = _a.placement, className = _a.className, readonly = _a.readonly;
    var styles = useStyles(getStyles);
    if (!itemRenderer) {
        /* eslint-disable-next-line react/display-name */
        itemRenderer = function (item) { return (React.createElement(VizLegendListItem, { item: item, onLabelClick: onLabelClick, onLabelMouseEnter: onLabelMouseEnter, onLabelMouseOut: onLabelMouseOut, readonly: readonly })); };
    }
    var getItemKey = function (item) { return "" + (item.getItemKey ? item.getItemKey() : item.label); };
    switch (placement) {
        case 'right': {
            var renderItem = function (item, index) {
                return React.createElement("span", { className: styles.itemRight }, itemRenderer(item, index));
            };
            return (React.createElement("div", { className: cx(styles.rightWrapper, className) },
                React.createElement(List, { items: items, renderItem: renderItem, getItemKey: getItemKey })));
        }
        case 'bottom':
        default: {
            var renderItem = function (item, index) {
                return React.createElement("span", { className: styles.itemBottom }, itemRenderer(item, index));
            };
            return (React.createElement("div", { className: cx(styles.bottomWrapper, className) },
                React.createElement("div", { className: styles.section },
                    React.createElement(InlineList, { items: items.filter(function (item) { return item.yAxis === 1; }), renderItem: renderItem, getItemKey: getItemKey })),
                React.createElement("div", { className: cx(styles.section, styles.sectionRight) },
                    React.createElement(InlineList, { items: items.filter(function (item) { return item.yAxis !== 1; }), renderItem: renderItem, getItemKey: getItemKey }))));
        }
    }
};
VizLegendList.displayName = 'VizLegendList';
var getStyles = function (theme) {
    var itemStyles = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding-right: 10px;\n    display: flex;\n    font-size: ", ";\n    white-space: nowrap;\n  "], ["\n    padding-right: 10px;\n    display: flex;\n    font-size: ", ";\n    white-space: nowrap;\n  "])), theme.typography.size.sm);
    return {
        itemBottom: itemStyles,
        itemRight: cx(itemStyles, css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        margin-bottom: ", ";\n      "], ["\n        margin-bottom: ", ";\n      "])), theme.spacing.xs)),
        rightWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding-left: ", ";\n    "], ["\n      padding-left: ", ";\n    "])), theme.spacing.sm),
        bottomWrapper: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: flex;\n      flex-wrap: wrap;\n      justify-content: space-between;\n      width: 100%;\n      padding-left: ", ";\n    "], ["\n      display: flex;\n      flex-wrap: wrap;\n      justify-content: space-between;\n      width: 100%;\n      padding-left: ", ";\n    "])), theme.spacing.md),
        section: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        sectionRight: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      justify-content: flex-end;\n      flex-grow: 1;\n    "], ["\n      justify-content: flex-end;\n      flex-grow: 1;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=VizLegendList.js.map