import { __assign, __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import { css } from '@emotion/css';
import { FixedSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { stylesFactory, useTheme, Spinner } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { SearchLayout } from '../types';
import { SEARCH_ITEM_HEIGHT, SEARCH_ITEM_MARGIN } from '../constants';
import { SearchItem } from './SearchItem';
import { SectionHeader } from './SectionHeader';
var _a = selectors.components.Search, sectionLabel = _a.section, itemsLabel = _a.items;
export var SearchResults = memo(function (_a) {
    var editable = _a.editable, loading = _a.loading, onTagSelected = _a.onTagSelected, onToggleChecked = _a.onToggleChecked, onToggleSection = _a.onToggleSection, results = _a.results, layout = _a.layout;
    var theme = useTheme();
    var styles = getSectionStyles(theme);
    var itemProps = { editable: editable, onToggleChecked: onToggleChecked, onTagSelected: onTagSelected };
    var renderFolders = function () {
        return (React.createElement("div", { className: styles.wrapper }, results.map(function (section) {
            return (React.createElement("div", { "aria-label": sectionLabel, className: styles.section, key: section.id || section.title },
                section.title && (React.createElement(SectionHeader, __assign({ onSectionClick: onToggleSection }, { onToggleChecked: onToggleChecked, editable: editable, section: section }))),
                section.expanded && (React.createElement("div", { "aria-label": itemsLabel, className: styles.sectionItems }, section.items.map(function (item) { return (React.createElement(SearchItem, __assign({ key: item.id }, itemProps, { item: item }))); })))));
        })));
    };
    var renderDashboards = function () {
        var _a;
        var items = (_a = results[0]) === null || _a === void 0 ? void 0 : _a.items;
        return (React.createElement("div", { className: styles.listModeWrapper },
            React.createElement(AutoSizer, { disableWidth: true }, function (_a) {
                var height = _a.height;
                return (React.createElement(FixedSizeList, { "aria-label": "Search items", className: styles.wrapper, innerElementType: "ul", itemSize: SEARCH_ITEM_HEIGHT + SEARCH_ITEM_MARGIN, height: height, itemCount: items.length, width: "100%" }, function (_a) {
                    var index = _a.index, style = _a.style;
                    var item = items[index];
                    // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
                    // And without this wrapper there is no room for that margin
                    return (React.createElement("li", { style: style },
                        React.createElement(SearchItem, __assign({ key: item.id }, itemProps, { item: item }))));
                }));
            })));
    };
    if (loading) {
        return React.createElement(Spinner, { className: styles.spinner });
    }
    else if (!results || !results.length) {
        return React.createElement("div", { className: styles.noResults }, "No dashboards matching your query were found.");
    }
    return (React.createElement("div", { className: styles.resultsContainer }, layout === SearchLayout.Folders ? renderFolders() : renderDashboards()));
});
SearchResults.displayName = 'SearchResults';
var getSectionStyles = stylesFactory(function (theme) {
    var md = theme.spacing.md;
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n    "], ["\n      display: flex;\n      flex-direction: column;\n    "]))),
        section: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      background: ", ";\n      border-bottom: solid 1px ", ";\n    "], ["\n      display: flex;\n      flex-direction: column;\n      background: ", ";\n      border-bottom: solid 1px ", ";\n    "])), theme.colors.panelBg, theme.colors.border2),
        sectionItems: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin: 0 24px 0 32px;\n    "], ["\n      margin: 0 24px 0 32px;\n    "]))),
        spinner: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: flex;\n      justify-content: center;\n      align-items: center;\n      min-height: 100px;\n    "], ["\n      display: flex;\n      justify-content: center;\n      align-items: center;\n      min-height: 100px;\n    "]))),
        resultsContainer: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      position: relative;\n      flex-grow: 10;\n      margin-bottom: ", ";\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: 3px;\n      height: 100%;\n    "], ["\n      position: relative;\n      flex-grow: 10;\n      margin-bottom: ", ";\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: 3px;\n      height: 100%;\n    "])), md, theme.colors.bg1, theme.colors.border1),
        noResults: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      padding: ", ";\n      background: ", ";\n      font-style: italic;\n      margin-top: ", ";\n    "], ["\n      padding: ", ";\n      background: ", ";\n      font-style: italic;\n      margin-top: ", ";\n    "])), md, theme.colors.bg2, theme.spacing.md),
        listModeWrapper: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      position: relative;\n      height: 100%;\n      padding: ", ";\n    "], ["\n      position: relative;\n      height: 100%;\n      padding: ", ";\n    "])), md),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=SearchResults.js.map