import { css } from '@emotion/css';
import React from 'react';
import { FieldMatcherID, getFrameDisplayName } from '@grafana/data';
import { PanelDataErrorView, reportInteraction } from '@grafana/runtime';
import { Select, Table, usePanelContext, useTheme2 } from '@grafana/ui';
import { hasDeprecatedParentRowIndex, migrateFromParentRowIndexToNestedFrames } from './migrations';
export const INTERACTION_EVENT_NAME = 'table_panel_usage';
export const INTERACTION_ITEM = {
    COLUMN_RESIZE: 'column_resize',
    SORT_BY: 'sort_by',
    TABLE_SELECTION_CHANGE: 'table_selection_change',
    ERROR_VIEW: 'error_view',
    CELL_TYPE_CHANGE: 'cell_type_change',
};
export function TablePanel(props) {
    var _a, _b;
    const { data, height, width, options, fieldConfig, id, timeRange } = props;
    const theme = useTheme2();
    const panelContext = usePanelContext();
    const frames = hasDeprecatedParentRowIndex(data.series)
        ? migrateFromParentRowIndexToNestedFrames(data.series)
        : data.series;
    const count = frames === null || frames === void 0 ? void 0 : frames.length;
    const hasFields = (_a = frames[0]) === null || _a === void 0 ? void 0 : _a.fields.length;
    const currentIndex = getCurrentFrameIndex(frames, options);
    const main = frames[currentIndex];
    let tableHeight = height;
    if (!count || !hasFields) {
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.ERROR_VIEW });
        return React.createElement(PanelDataErrorView, { panelId: id, fieldConfig: fieldConfig, data: data });
    }
    if (count > 1) {
        const inputHeight = theme.spacing.gridSize * theme.components.height.md;
        const padding = theme.spacing.gridSize;
        tableHeight = height - inputHeight - padding;
    }
    const tableElement = (React.createElement(Table, { height: tableHeight, width: width, data: main, noHeader: !options.showHeader, showTypeIcons: options.showTypeIcons, resizable: true, initialSortBy: options.sortBy, onSortByChange: (sortBy) => onSortByChange(sortBy, props), onColumnResize: (displayName, resizedWidth) => onColumnResize(displayName, resizedWidth, props), onCellFilterAdded: panelContext.onAddAdHocFilter, footerOptions: options.footer, enablePagination: (_b = options.footer) === null || _b === void 0 ? void 0 : _b.enablePagination, cellHeight: options.cellHeight, timeRange: timeRange }));
    if (count === 1) {
        return tableElement;
    }
    const names = frames.map((frame, index) => {
        return {
            label: getFrameDisplayName(frame),
            value: index,
        };
    });
    return (React.createElement("div", { className: tableStyles.wrapper },
        tableElement,
        React.createElement("div", { className: tableStyles.selectWrapper },
            React.createElement(Select, { options: names, value: names[currentIndex], onChange: (val) => onChangeTableSelection(val, props) }))));
}
function getCurrentFrameIndex(frames, options) {
    return options.frameIndex > 0 && options.frameIndex < frames.length ? options.frameIndex : 0;
}
function onColumnResize(fieldDisplayName, width, props) {
    const { fieldConfig } = props;
    const { overrides } = fieldConfig;
    const matcherId = FieldMatcherID.byName;
    const propId = 'custom.width';
    // look for existing override
    const override = overrides.find((o) => o.matcher.id === matcherId && o.matcher.options === fieldDisplayName);
    if (override) {
        // look for existing property
        const property = override.properties.find((prop) => prop.id === propId);
        if (property) {
            property.value = width;
        }
        else {
            override.properties.push({ id: propId, value: width });
        }
    }
    else {
        overrides.push({
            matcher: { id: matcherId, options: fieldDisplayName },
            properties: [{ id: propId, value: width }],
        });
    }
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.COLUMN_RESIZE });
    props.onFieldConfigChange(Object.assign(Object.assign({}, fieldConfig), { overrides }));
}
function onSortByChange(sortBy, props) {
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.SORT_BY });
    props.onOptionsChange(Object.assign(Object.assign({}, props.options), { sortBy }));
}
function onChangeTableSelection(val, props) {
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.TABLE_SELECTION_CHANGE });
    props.onOptionsChange(Object.assign(Object.assign({}, props.options), { frameIndex: val.value || 0 }));
}
const tableStyles = {
    wrapper: css `
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  `,
    selectWrapper: css `
    padding: 8px 8px 0px 8px;
  `,
};
//# sourceMappingURL=TablePanel.js.map