import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useCallback } from 'react';
import { FieldColorModeId, getColorForTheme } from '@grafana/data';
import { identity } from 'lodash';
import { css } from '@emotion/css';
import { LegendDisplayMode } from '@grafana/schema';
import { Icon, useStyles, useTheme, VizLegend, VizLegendListItem } from '@grafana/ui';
function getStyles() {
    return {
        item: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: LegendItem;\n      flex-grow: 0;\n    "], ["\n      label: LegendItem;\n      flex-grow: 0;\n    "]))),
        legend: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: Legend;\n      pointer-events: all;\n    "], ["\n      label: Legend;\n      pointer-events: all;\n    "]))),
    };
}
export var Legend = function Legend(props) {
    var nodes = props.nodes, onSort = props.onSort, sort = props.sort, sortable = props.sortable;
    var theme = useTheme();
    var styles = useStyles(getStyles);
    var colorItems = getColorLegendItems(nodes, theme);
    var onClick = useCallback(function (item) {
        onSort({
            field: item.data.field,
            ascending: item.data.field === (sort === null || sort === void 0 ? void 0 : sort.field) ? !(sort === null || sort === void 0 ? void 0 : sort.ascending) : false,
        });
    }, [sort, onSort]);
    return (React.createElement(VizLegend, { className: styles.legend, displayMode: LegendDisplayMode.List, placement: 'bottom', items: colorItems, itemRenderer: function (item) {
            return (React.createElement(React.Fragment, null,
                React.createElement(VizLegendListItem, { item: item, className: styles.item, onLabelClick: sortable ? onClick : undefined }),
                sortable &&
                    ((sort === null || sort === void 0 ? void 0 : sort.field) === item.data.field ? React.createElement(Icon, { name: sort.ascending ? 'arrow-up' : 'arrow-down' }) : '')));
        } }));
};
function getColorLegendItems(nodes, theme) {
    var _a, _b;
    if (!nodes.length) {
        return [];
    }
    var fields = [nodes[0].mainStat, nodes[0].secondaryStat].filter(identity);
    var node = nodes.find(function (n) { return n.arcSections.length > 0; });
    if (node) {
        if (((_b = (_a = node.arcSections[0].config) === null || _a === void 0 ? void 0 : _a.color) === null || _b === void 0 ? void 0 : _b.mode) === FieldColorModeId.Fixed) {
            // We assume in this case we have a set of fixed colors which map neatly into a basic legend.
            // Lets collect and deduplicate as there isn't a requirement for 0 size arc section to be defined
            fields.push.apply(fields, __spreadArray([], __read(new Set(nodes.map(function (n) { return n.arcSections; }).flat())), false));
        }
    }
    if (nodes[0].color) {
        fields.push(nodes[0].color);
    }
    return fields.map(function (f) {
        var _a, _b, _c, _d, _e;
        var item = {
            label: f.config.displayName || f.name,
            yAxis: 0,
            data: { field: f },
        };
        if (((_a = f.config.color) === null || _a === void 0 ? void 0 : _a.mode) === FieldColorModeId.Fixed && ((_b = f.config.color) === null || _b === void 0 ? void 0 : _b.fixedColor)) {
            item.color = getColorForTheme(((_c = f.config.color) === null || _c === void 0 ? void 0 : _c.fixedColor) || '', theme);
        }
        else if ((_d = f.config.color) === null || _d === void 0 ? void 0 : _d.mode) {
            item.gradient = (_e = f.config.color) === null || _e === void 0 ? void 0 : _e.mode;
        }
        if (!(item.color || item.gradient)) {
            // Defaults to gray color
            item.color = getColorForTheme('', theme);
        }
        return item;
    });
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=Legend.js.map