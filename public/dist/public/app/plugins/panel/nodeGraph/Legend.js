import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { FieldColorModeId } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { Icon, useStyles2, useTheme2, VizLegend, VizLegendListItem } from '@grafana/ui';
function getStyles() {
    return {
        item: css `
      label: LegendItem;
      flex-grow: 0;
    `,
        legend: css `
      label: Legend;
      pointer-events: all;
    `,
    };
}
export const Legend = function Legend(props) {
    const { nodes, onSort, sort, sortable } = props;
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const colorItems = getColorLegendItems(nodes, theme);
    const onClick = useCallback((item) => {
        onSort({
            field: item.data.field,
            ascending: item.data.field === (sort === null || sort === void 0 ? void 0 : sort.field) ? !(sort === null || sort === void 0 ? void 0 : sort.ascending) : false,
        });
    }, [sort, onSort]);
    return (React.createElement(VizLegend, { className: styles.legend, displayMode: LegendDisplayMode.List, placement: 'bottom', items: colorItems, itemRenderer: (item) => {
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
    const fields = [nodes[0].mainStat, nodes[0].secondaryStat].filter((item) => Boolean(item));
    const node = nodes.find((n) => n.arcSections.length > 0);
    if (node) {
        if (((_b = (_a = node.arcSections[0].config) === null || _a === void 0 ? void 0 : _a.color) === null || _b === void 0 ? void 0 : _b.mode) === FieldColorModeId.Fixed) {
            // We assume in this case we have a set of fixed colors which map neatly into a basic legend.
            // Lets collect and deduplicate as there isn't a requirement for 0 size arc section to be defined
            fields.push(...new Set(nodes.map((n) => n.arcSections).flat()));
        }
    }
    if (nodes[0].color) {
        fields.push(nodes[0].color);
    }
    return fields.map((f) => {
        var _a, _b, _c, _d, _e;
        const item = {
            label: f.config.displayName || f.name,
            yAxis: 0,
            data: { field: f },
        };
        if (((_a = f.config.color) === null || _a === void 0 ? void 0 : _a.mode) === FieldColorModeId.Fixed && ((_b = f.config.color) === null || _b === void 0 ? void 0 : _b.fixedColor)) {
            item.color = theme.visualization.getColorByName(((_c = f.config.color) === null || _c === void 0 ? void 0 : _c.fixedColor) || '');
        }
        else if ((_d = f.config.color) === null || _d === void 0 ? void 0 : _d.mode) {
            item.gradient = (_e = f.config.color) === null || _e === void 0 ? void 0 : _e.mode;
        }
        if (!(item.color || item.gradient)) {
            // Defaults to gray color
            item.color = theme.visualization.getColorByName('');
        }
        return item;
    });
}
//# sourceMappingURL=Legend.js.map