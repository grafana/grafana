import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useMemo, useReducer } from 'react';
import { useDebounce } from 'react-use';
import { css, cx } from '@emotion/css';
import { Pagination, useStyles } from '@grafana/ui';
import { LoadingState } from '@grafana/data';
import { LibraryPanelCard } from '../LibraryPanelCard/LibraryPanelCard';
import { changePage, initialLibraryPanelsViewState, libraryPanelsViewReducer } from './reducer';
import { asyncDispatcher, deleteLibraryPanel, searchForLibraryPanels } from './actions';
export var LibraryPanelsView = function (_a) {
    var className = _a.className, onClickCard = _a.onClickCard, searchString = _a.searchString, sortDirection = _a.sortDirection, panelFilter = _a.panelFilter, folderFilter = _a.folderFilter, showSecondaryActions = _a.showSecondaryActions, currentPanel = _a.currentPanelId, _b = _a.perPage, propsPerPage = _b === void 0 ? 40 : _b;
    var styles = useStyles(getPanelViewStyles);
    var _c = __read(useReducer(libraryPanelsViewReducer, __assign(__assign({}, initialLibraryPanelsViewState), { currentPanelId: currentPanel, perPage: propsPerPage })), 2), _d = _c[0], libraryPanels = _d.libraryPanels, page = _d.page, perPage = _d.perPage, numberOfPages = _d.numberOfPages, loadingState = _d.loadingState, currentPanelId = _d.currentPanelId, dispatch = _c[1];
    var asyncDispatch = useMemo(function () { return asyncDispatcher(dispatch); }, [dispatch]);
    useDebounce(function () {
        return asyncDispatch(searchForLibraryPanels({
            searchString: searchString,
            sortDirection: sortDirection,
            panelFilter: panelFilter,
            folderFilter: folderFilter,
            page: page,
            perPage: perPage,
            currentPanelId: currentPanelId,
        }));
    }, 300, [searchString, sortDirection, panelFilter, folderFilter, page, asyncDispatch]);
    var onDelete = function (_a) {
        var uid = _a.uid;
        return asyncDispatch(deleteLibraryPanel(uid, { searchString: searchString, page: page, perPage: perPage }));
    };
    var onPageChange = function (page) { return asyncDispatch(changePage({ page: page })); };
    return (React.createElement("div", { className: cx(styles.container, className) },
        React.createElement("div", { className: styles.libraryPanelList }, loadingState === LoadingState.Loading ? (React.createElement("p", null, "Loading library panels...")) : libraryPanels.length < 1 ? (React.createElement("p", { className: styles.noPanelsFound }, "No library panels found.")) : (libraryPanels === null || libraryPanels === void 0 ? void 0 : libraryPanels.map(function (item, i) { return (React.createElement(LibraryPanelCard, { key: "library-panel=" + i, libraryPanel: item, onDelete: onDelete, onClick: onClickCard, showSecondaryActions: showSecondaryActions })); }))),
        libraryPanels.length ? (React.createElement("div", { className: styles.pagination },
            React.createElement(Pagination, { currentPage: page, numberOfPages: numberOfPages, onNavigate: onPageChange, hideWhenSinglePage: true }))) : null));
};
var getPanelViewStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      flex-wrap: nowrap;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      flex-wrap: nowrap;\n    "]))),
        libraryPanelList: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      max-width: 100%;\n      display: grid;\n      grid-gap: ", ";\n    "], ["\n      max-width: 100%;\n      display: grid;\n      grid-gap: ", ";\n    "])), theme.spacing.sm),
        searchHeader: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        newPanelButton: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-top: 10px;\n      align-self: flex-start;\n    "], ["\n      margin-top: 10px;\n      align-self: flex-start;\n    "]))),
        pagination: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      align-self: center;\n      margin-top: ", ";\n    "], ["\n      align-self: center;\n      margin-top: ", ";\n    "])), theme.spacing.sm),
        noPanelsFound: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      label: noPanelsFound;\n      min-height: 200px;\n    "], ["\n      label: noPanelsFound;\n      min-height: 200px;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=LibraryPanelsView.js.map