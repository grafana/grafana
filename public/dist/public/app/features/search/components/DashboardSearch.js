import { __assign, __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import { css } from '@emotion/css';
import { useTheme2, CustomScrollbar, stylesFactory, IconButton } from '@grafana/ui';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { useDashboardSearch } from '../hooks/useDashboardSearch';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';
import { ActionRow } from './ActionRow';
export var DashboardSearch = memo(function (_a) {
    var onCloseSearch = _a.onCloseSearch;
    var _b = useSearchQuery({}), query = _b.query, onQueryChange = _b.onQueryChange, onTagFilterChange = _b.onTagFilterChange, onTagAdd = _b.onTagAdd, onSortChange = _b.onSortChange, onLayoutChange = _b.onLayoutChange;
    var _c = useDashboardSearch(query, onCloseSearch), results = _c.results, loading = _c.loading, onToggleSection = _c.onToggleSection, onKeyDown = _c.onKeyDown;
    var theme = useTheme2();
    var styles = getStyles(theme);
    return (React.createElement("div", { tabIndex: 0, className: styles.overlay },
        React.createElement("div", { className: styles.container },
            React.createElement("div", { className: styles.searchField },
                React.createElement(SearchField, { query: query, onChange: onQueryChange, onKeyDown: onKeyDown, autoFocus: true, clearable: true }),
                React.createElement("div", { className: styles.closeBtn },
                    React.createElement(IconButton, { name: "times", surface: "panel", onClick: onCloseSearch, size: "xxl", tooltip: "Close search" }))),
            React.createElement("div", { className: styles.search },
                React.createElement(ActionRow, __assign({}, {
                    onLayoutChange: onLayoutChange,
                    onSortChange: onSortChange,
                    onTagFilterChange: onTagFilterChange,
                    query: query,
                })),
                React.createElement(CustomScrollbar, null,
                    React.createElement(SearchResults, { results: results, loading: loading, onTagSelected: onTagAdd, editable: false, onToggleSection: onToggleSection, layout: query.layout }))))));
});
DashboardSearch.displayName = 'DashboardSearch';
export default DashboardSearch;
var getStyles = stylesFactory(function (theme) {
    return {
        overlay: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0;\n      z-index: ", ";\n      position: fixed;\n      background: ", ";\n\n      ", " {\n        left: ", "px;\n        z-index: ", ";\n      }\n    "], ["\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0;\n      z-index: ", ";\n      position: fixed;\n      background: ", ";\n\n      ", " {\n        left: ", "px;\n        z-index: ", ";\n      }\n    "])), theme.zIndex.sidemenu, theme.colors.background.canvas, theme.breakpoints.up('md'), theme.components.sidemenu.width, theme.zIndex.navbarFixed + 1),
        container: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      max-width: 1400px;\n      margin: 0 auto;\n      padding: ", ";\n\n      height: 100%;\n\n      ", " {\n        padding: ", ";\n      }\n    "], ["\n      max-width: 1400px;\n      margin: 0 auto;\n      padding: ", ";\n\n      height: 100%;\n\n      ", " {\n        padding: ", ";\n      }\n    "])), theme.spacing(2), theme.breakpoints.up('md'), theme.spacing(4)),
        closeBtn: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      right: -5px;\n      top: 2px;\n      z-index: 1;\n      position: absolute;\n    "], ["\n      right: -5px;\n      top: 2px;\n      z-index: 1;\n      position: absolute;\n    "]))),
        searchField: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      position: relative;\n    "], ["\n      position: relative;\n    "]))),
        search: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      padding-bottom: ", ";\n    "], ["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      padding-bottom: ", ";\n    "])), theme.spacing(3)),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=DashboardSearch.js.map