import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useReducer } from 'react';
import { HorizontalGroup, useStyles2, VerticalGroup, FilterInput } from '@grafana/ui';
import { css } from '@emotion/css';
import { SortPicker } from '../../../../core/components/Select/SortPicker';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../core/constants';
import { FolderFilter } from '../../../../core/components/FolderFilter/FolderFilter';
import { folderFilterChanged, initialLibraryPanelsSearchState, libraryPanelsSearchReducer, panelFilterChanged, searchChanged, sortChanged, } from './reducer';
export var LibraryPanelsSearchVariant;
(function (LibraryPanelsSearchVariant) {
    LibraryPanelsSearchVariant["Tight"] = "tight";
    LibraryPanelsSearchVariant["Spacious"] = "spacious";
})(LibraryPanelsSearchVariant || (LibraryPanelsSearchVariant = {}));
export var LibraryPanelsSearch = function (_a) {
    var onClick = _a.onClick, _b = _a.variant, variant = _b === void 0 ? LibraryPanelsSearchVariant.Spacious : _b, currentPanelId = _a.currentPanelId, currentFolderId = _a.currentFolderId, _c = _a.perPage, perPage = _c === void 0 ? DEFAULT_PER_PAGE_PAGINATION : _c, _d = _a.showPanelFilter, showPanelFilter = _d === void 0 ? false : _d, _e = _a.showFolderFilter, showFolderFilter = _e === void 0 ? false : _e, _f = _a.showSort, showSort = _f === void 0 ? false : _f, _g = _a.showSecondaryActions, showSecondaryActions = _g === void 0 ? false : _g;
    var styles = useStyles2(getStyles);
    var _h = __read(useReducer(libraryPanelsSearchReducer, __assign(__assign({}, initialLibraryPanelsSearchState), { folderFilter: currentFolderId ? [currentFolderId.toString(10)] : [] })), 2), _j = _h[0], sortDirection = _j.sortDirection, panelFilter = _j.panelFilter, folderFilter = _j.folderFilter, searchQuery = _j.searchQuery, dispatch = _h[1];
    var onFilterChange = function (searchString) { return dispatch(searchChanged(searchString)); };
    var onSortChange = function (sorting) { return dispatch(sortChanged(sorting)); };
    var onFolderFilterChange = function (folders) { return dispatch(folderFilterChanged(folders)); };
    var onPanelFilterChange = function (plugins) { return dispatch(panelFilterChanged(plugins)); };
    if (variant === LibraryPanelsSearchVariant.Spacious) {
        return (React.createElement("div", { className: styles.container },
            React.createElement(VerticalGroup, { spacing: "lg" },
                React.createElement(FilterInput, { value: searchQuery, onChange: onFilterChange, placeholder: 'Search by name or description', width: 0 }),
                React.createElement(HorizontalGroup, { spacing: "sm", justify: (showSort && showPanelFilter) || showFolderFilter ? 'space-between' : 'flex-end' },
                    showSort && (React.createElement(SortPicker, { value: sortDirection, onChange: onSortChange, filter: ['alpha-asc', 'alpha-desc'] })),
                    React.createElement(HorizontalGroup, { spacing: "sm", justify: showFolderFilter && showPanelFilter ? 'space-between' : 'flex-end' },
                        showFolderFilter && React.createElement(FolderFilter, { onChange: onFolderFilterChange }),
                        showPanelFilter && React.createElement(PanelTypeFilter, { onChange: onPanelFilterChange }))),
                React.createElement("div", { className: styles.libraryPanelsView },
                    React.createElement(LibraryPanelsView, { onClickCard: onClick, searchString: searchQuery, sortDirection: sortDirection, panelFilter: panelFilter, folderFilter: folderFilter, currentPanelId: currentPanelId, showSecondaryActions: showSecondaryActions, perPage: perPage })))));
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement(VerticalGroup, { spacing: "xs" },
            React.createElement("div", { className: styles.buttonRow },
                React.createElement("div", { className: styles.tightFilter },
                    React.createElement(FilterInput, { value: searchQuery, onChange: onFilterChange, placeholder: 'Search by name', width: 0 })),
                React.createElement("div", { className: styles.tightSortFilter },
                    showSort && React.createElement(SortPicker, { value: sortDirection, onChange: onSortChange }),
                    showFolderFilter && React.createElement(FolderFilter, { onChange: onFolderFilterChange, maxMenuHeight: 200 }),
                    showPanelFilter && React.createElement(PanelTypeFilter, { onChange: onPanelFilterChange, maxMenuHeight: 200 }))),
            React.createElement("div", { className: styles.libraryPanelsView },
                React.createElement(LibraryPanelsView, { onClickCard: onClick, searchString: searchQuery, sortDirection: sortDirection, panelFilter: panelFilter, folderFilter: folderFilter, currentPanelId: currentPanelId, showSecondaryActions: showSecondaryActions, perPage: perPage })))));
};
function getStyles(theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 100%;\n      overflow-y: auto;\n      padding: ", ";\n      min-height: 400px;\n    "], ["\n      width: 100%;\n      overflow-y: auto;\n      padding: ", ";\n      min-height: 400px;\n    "])), theme.spacing(1)),
        buttonRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      width: 100%;\n      margin-top: ", "; // Clear types link\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      width: 100%;\n      margin-top: ", "; // Clear types link\n    "])), theme.spacing(1.5)),
        tightFilter: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      flex-grow: 1;\n    "], ["\n      flex-grow: 1;\n    "]))),
        tightSortFilter: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      flex-grow: 1;\n      padding: ", ";\n    "], ["\n      flex-grow: 1;\n      padding: ", ";\n    "])), theme.spacing(0, 0, 0, 0.5)),
        libraryPanelsView: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      width: 100%;\n    "], ["\n      width: 100%;\n    "]))),
    };
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=LibraryPanelsSearch.js.map