import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { CompactSelection, GridCellKind } from '@glideapps/glide-data-grid';
import { FieldType } from '@grafana/data';
import { isDatagridEnabled } from './featureFlagUtils';
const HEADER_FONT_FAMILY = '600 13px Inter';
const CELL_FONT_FAMILY = '400 13px Inter';
const TEXT_CANVAS = document.createElement('canvas');
export const CELL_PADDING = 20;
export const MAX_COLUMN_WIDTH = 300;
export const ICON_AND_MENU_WIDTH = 65;
export const ROW_MARKER_BOTH = 'both';
export const ROW_MARKER_NUMBER = 'number';
export const DEFAULT_CONTEXT_MENU = { isContextMenuOpen: false };
export const DEFAULT_RENAME_INPUT_DATA = { isInputOpen: false };
export const INTERACTION_EVENT_NAME = 'datagrid_panel';
export const INTERACTION_ITEM = {
    EDIT_CELL: 'edit_cell',
    GRID_SELECTED: 'grid_selected',
    APPEND_ROW: 'append_row',
    APPEND_COLUMN: 'append_column',
    DELETE_BTN_PRESSED: 'delete_btn_pressed',
    COLUMN_RESIZE: 'column_resize',
    COLUMN_REORDER: 'column_reorder',
    ROW_REORDER: 'row_reorder',
    CONTEXT_MENU_ACTION: 'context_menu_action',
    HEADER_MENU_ACTION: 'header_menu_action',
};
export const EMPTY_DF = {
    name: 'A',
    fields: [],
    length: 0,
};
export const EMPTY_CELL = {
    kind: GridCellKind.Text,
    data: '',
    allowOverlay: true,
    readonly: false,
    displayData: '',
};
export const EMPTY_GRID_SELECTION = {
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
};
export const TRAILING_ROW_OPTIONS = {
    sticky: false,
    tint: true,
};
export const RIGHT_ELEMENT_PROPS = {
    fill: true,
    sticky: false,
};
export function updateSnapshot(frame, updateData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (updateData && isDatagridEnabled()) {
            for (let i = 0; i < frame.fields.length; i++) {
                delete frame.fields[i].config.displayName;
                delete frame.fields[i].config.displayNameFromDS;
            }
            return yield updateData([frame]);
        }
        return false;
    });
}
export const getTextWidth = (text, isHeader = false) => {
    const context = TEXT_CANVAS.getContext('2d');
    context.font = isHeader ? HEADER_FONT_FAMILY : CELL_FONT_FAMILY;
    const metrics = context.measureText(text);
    return metrics.width;
};
export const getCellWidth = (field) => {
    //If header is longer than cell text, get header width that will always fully show the header text
    //otherwise get the longest cell text width if it's shorter than the max column width, or the max column width
    return Math.max(getTextWidth(field.name, true) + ICON_AND_MENU_WIDTH, //header text
    Math.min(MAX_COLUMN_WIDTH, field.values.toArray().reduce((acc, val) => {
        var _a;
        const textWidth = getTextWidth((_a = val === null || val === void 0 ? void 0 : val.toString()) !== null && _a !== void 0 ? _a : '');
        if (textWidth > acc) {
            return textWidth;
        }
        return acc;
    }, 0) + CELL_PADDING //cell text
    ));
};
export const deleteRows = (gridData, rows, hardDelete = false) => {
    var _a, _b;
    const copy = Object.assign(Object.assign({}, gridData), { fields: gridData.fields.map((field) => (Object.assign(Object.assign({}, field), { values: field.values.slice() }))) });
    for (const field of copy.fields) {
        const valuesArray = field.values.toArray();
        //delete from the end of the array to avoid index shifting
        for (let i = rows.length - 1; i >= 0; i--) {
            if (hardDelete) {
                valuesArray.splice(rows[i], 1);
            }
            else {
                valuesArray.splice(rows[i], 1, null);
            }
        }
        field.values = [...valuesArray];
    }
    return Object.assign(Object.assign({}, copy), { length: (_b = (_a = copy.fields[0]) === null || _a === void 0 ? void 0 : _a.values.length) !== null && _b !== void 0 ? _b : 0 });
};
export const clearCellsFromRangeSelection = (gridData, range) => {
    var _a, _b;
    const colFrom = range.x;
    const rowFrom = range.y;
    const colTo = range.x + range.width - 1;
    const copy = Object.assign(Object.assign({}, gridData), { fields: gridData.fields.map((field) => (Object.assign(Object.assign({}, field), { values: field.values.slice() }))) });
    for (let i = colFrom; i <= colTo; i++) {
        const field = copy.fields[i];
        const valuesArray = field.values.toArray();
        valuesArray.splice(rowFrom, range.height, ...new Array(range.height).fill(null));
        field.values = [...valuesArray];
    }
    return Object.assign(Object.assign({}, copy), { length: (_b = (_a = copy.fields[0]) === null || _a === void 0 ? void 0 : _a.values.length) !== null && _b !== void 0 ? _b : 0 });
};
//Converting an array of nulls or undefineds returns them as strings and prints them in the cells instead of empty cells. Thus the cleanup func
export const cleanStringFieldAfterConversion = (field) => {
    const valuesArray = field.values.toArray();
    field.values = valuesArray.map((val) => (val === 'undefined' || val === 'null' ? null : val));
    return;
};
export function getGridTheme(theme) {
    return {
        accentColor: theme.colors.primary.main,
        accentFg: theme.colors.secondary.main,
        textDark: theme.colors.text.primary,
        textMedium: theme.colors.text.secondary,
        textLight: theme.colors.text.secondary,
        textBubble: theme.colors.text.primary,
        textHeader: theme.colors.text.primary,
        bgCell: theme.colors.background.primary,
        bgCellMedium: theme.colors.background.primary,
        bgHeader: theme.colors.background.primary,
        bgHeaderHasFocus: theme.colors.background.secondary,
        bgHeaderHovered: theme.colors.background.secondary,
        linkColor: theme.colors.text.link,
        fontFamily: theme.typography.fontFamily,
        headerFontStyle: `${theme.typography.fontWeightMedium} ${theme.typography.fontSize}px`,
        fgIconHeader: theme.colors.secondary.contrastText,
        bgIconHeader: theme.colors.secondary.main,
    };
}
export const getGridCellKind = (field, row, hasGridSelection = false) => {
    const value = field.values.get(row);
    switch (field.type) {
        case FieldType.boolean:
            return {
                kind: GridCellKind.Boolean,
                data: value ? value : false,
                allowOverlay: false,
                readonly: false,
            };
        case FieldType.number:
            return {
                kind: GridCellKind.Number,
                data: value ? value : 0,
                allowOverlay: isDatagridEnabled() && !hasGridSelection,
                readonly: false,
                displayData: value !== null && value !== undefined ? value.toString() : '',
            };
        case FieldType.string:
            return {
                kind: GridCellKind.Text,
                data: value ? value : '',
                allowOverlay: isDatagridEnabled() && !hasGridSelection,
                readonly: false,
                displayData: value !== null && value !== undefined ? value.toString() : '',
            };
        default:
            return {
                kind: GridCellKind.Text,
                data: value ? value : '',
                allowOverlay: isDatagridEnabled() && !hasGridSelection,
                readonly: false,
                displayData: value !== null && value !== undefined ? value.toString() : '',
            };
    }
};
export const getStyles = (theme, isResizeInProgress) => {
    return {
        dataEditor: css `
      .dvn-scroll-inner > div:nth-child(2) {
        pointer-events: none !important;
      }
      scrollbar-color: ${theme.colors.background.secondary} ${theme.colors.background.primary};
      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      ::-webkit-scrollbar-track {
        background: ${theme.colors.background.primary};
      }
      ::-webkit-scrollbar-thumb {
        border-radius: 10px;
      }
      ::-webkit-scrollbar-corner {
        display: none;
      }
    `,
        addColumnDiv: css `
      width: 120px;
      display: flex;
      flex-direction: column;
      background-color: ${theme.colors.background.primary};
      button {
        pointer-events: ${isResizeInProgress ? 'none' : 'auto'};
        border: none;
        outline: none;
        height: 37px;
        font-size: 20px;
        background-color: ${theme.colors.background.primary};
        color: ${theme.colors.text.primary};
        border-right: 1px solid ${theme.components.panel.borderColor};
        border-bottom: 1px solid ${theme.components.panel.borderColor};
        transition: background-color 200ms;
        cursor: pointer;
        :hover {
          background-color: ${theme.colors.background.secondary};
        }
      }
      input {
        height: 37px;
        border: 1px solid ${theme.colors.primary.main};
        :focus {
          outline: none;
        }
      }
    `,
        renameColumnInput: css `
      height: 37px;
      border: 1px solid ${theme.colors.primary.main};
      :focus {
        outline: none;
      }
    `,
    };
};
export const hasGridSelection = (gridSelection) => {
    if (gridSelection.rows.length || gridSelection.columns.length) {
        return true;
    }
    if (gridSelection.current === undefined) {
        return false;
    }
    return (gridSelection.current.range &&
        !(gridSelection.current.range.height === 1 && gridSelection.current.range.width === 1));
};
//# sourceMappingURL=utils.js.map