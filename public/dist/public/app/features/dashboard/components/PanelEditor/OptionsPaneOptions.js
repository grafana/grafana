import { __makeTemplateObject, __read, __spreadArray, __values } from "tslib";
import React, { useMemo, useState } from 'react';
import { CustomScrollbar, FilterInput, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { getPanelFrameCategory } from './getPanelFrameOptions';
import { getVizualizationOptions } from './getVizualizationOptions';
import { css } from '@emotion/css';
import { OptionsPaneCategory } from './OptionsPaneCategory';
import { getFieldOverrideCategories } from './getFieldOverrideElements';
import { OptionSearchEngine } from './state/OptionSearchEngine';
import { AngularPanelOptions } from './AngularPanelOptions';
import { getRecentOptions } from './state/getRecentOptions';
import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { getLibraryPanelOptionsCategory } from './getLibraryPanelOptions';
export var OptionsPaneOptions = function (props) {
    var e_1, _a, e_2, _b, e_3, _c;
    var plugin = props.plugin, dashboard = props.dashboard, panel = props.panel;
    var _d = __read(useState(''), 2), searchQuery = _d[0], setSearchQuery = _d[1];
    var _e = __read(useState(OptionFilter.All), 2), listMode = _e[0], setListMode = _e[1];
    var styles = useStyles2(getStyles);
    var _f = __read(useMemo(function () { return [
        getPanelFrameCategory(props),
        getVizualizationOptions(props),
        getFieldOverrideCategories(props),
        getLibraryPanelOptionsCategory(props),
    ]; }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel.configRev, props.data, props.instanceState]), 4), panelFrameOptions = _f[0], vizOptions = _f[1], justOverrides = _f[2], libraryPanelOptions = _f[3];
    var mainBoxElements = [];
    var isSearching = searchQuery.length > 0;
    var optionRadioFilters = useMemo(getOptionRadioFilters, []);
    var allOptions = isPanelModelLibraryPanel(panel)
        ? __spreadArray([libraryPanelOptions, panelFrameOptions], __read(vizOptions), false) : __spreadArray([panelFrameOptions], __read(vizOptions), false);
    if (isSearching) {
        mainBoxElements.push(renderSearchHits(allOptions, justOverrides, searchQuery));
        // If searching for angular panel, then we need to add notice that results are limited
        if (props.plugin.angularPanelCtrl) {
            mainBoxElements.push(React.createElement("div", { className: styles.searchNotice, key: "Search notice" }, "This is an old visualization type that does not support searching all options."));
        }
    }
    else {
        switch (listMode) {
            case OptionFilter.All:
                if (isPanelModelLibraryPanel(panel)) {
                    // Library Panel options first
                    mainBoxElements.push(libraryPanelOptions.render());
                }
                // Panel frame options second
                mainBoxElements.push(panelFrameOptions.render());
                // If angular add those options next
                if (props.plugin.angularPanelCtrl) {
                    mainBoxElements.push(React.createElement(AngularPanelOptions, { plugin: plugin, dashboard: dashboard, panel: panel, key: "AngularOptions" }));
                }
                try {
                    // Then add all panel and field defaults
                    for (var vizOptions_1 = __values(vizOptions), vizOptions_1_1 = vizOptions_1.next(); !vizOptions_1_1.done; vizOptions_1_1 = vizOptions_1.next()) {
                        var item = vizOptions_1_1.value;
                        mainBoxElements.push(item.render());
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (vizOptions_1_1 && !vizOptions_1_1.done && (_a = vizOptions_1.return)) _a.call(vizOptions_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                try {
                    for (var justOverrides_1 = __values(justOverrides), justOverrides_1_1 = justOverrides_1.next(); !justOverrides_1_1.done; justOverrides_1_1 = justOverrides_1.next()) {
                        var item = justOverrides_1_1.value;
                        mainBoxElements.push(item.render());
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (justOverrides_1_1 && !justOverrides_1_1.done && (_b = justOverrides_1.return)) _b.call(justOverrides_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                break;
            case OptionFilter.Overrides:
                try {
                    for (var justOverrides_2 = __values(justOverrides), justOverrides_2_1 = justOverrides_2.next(); !justOverrides_2_1.done; justOverrides_2_1 = justOverrides_2.next()) {
                        var override = justOverrides_2_1.value;
                        mainBoxElements.push(override.render());
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (justOverrides_2_1 && !justOverrides_2_1.done && (_c = justOverrides_2.return)) _c.call(justOverrides_2);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                break;
            case OptionFilter.Recent:
                mainBoxElements.push(React.createElement(OptionsPaneCategory, { id: "Recent options", title: "Recent options", key: "Recent options", forceOpen: 1 }, getRecentOptions(allOptions).map(function (item) { return item.render(); })));
                break;
        }
    }
    // only show radio buttons if we are searching or if the plugin has field config
    var showSearchRadioButtons = !isSearching && !plugin.fieldConfigRegistry.isEmpty();
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.formBox },
            React.createElement("div", { className: styles.formRow },
                React.createElement(FilterInput, { width: 0, value: searchQuery, onChange: setSearchQuery, placeholder: 'Search options' })),
            showSearchRadioButtons && (React.createElement("div", { className: styles.formRow },
                React.createElement(RadioButtonGroup, { options: optionRadioFilters, value: listMode, fullWidth: true, onChange: setListMode })))),
        React.createElement("div", { className: styles.scrollWrapper },
            React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
                React.createElement("div", { className: styles.mainBox }, mainBoxElements)))));
};
function getOptionRadioFilters() {
    return [
        { label: OptionFilter.All, value: OptionFilter.All },
        { label: OptionFilter.Overrides, value: OptionFilter.Overrides },
    ];
}
export var OptionFilter;
(function (OptionFilter) {
    OptionFilter["All"] = "All";
    OptionFilter["Overrides"] = "Overrides";
    OptionFilter["Recent"] = "Recent";
})(OptionFilter || (OptionFilter = {}));
function renderSearchHits(allOptions, overrides, searchQuery) {
    var engine = new OptionSearchEngine(allOptions, overrides);
    var _a = engine.search(searchQuery), optionHits = _a.optionHits, totalCount = _a.totalCount, overrideHits = _a.overrideHits;
    return (React.createElement("div", { key: "search results" },
        React.createElement(OptionsPaneCategory, { id: "Found options", title: "Matched " + optionHits.length + "/" + totalCount + " options", key: "Normal options", forceOpen: 1 }, optionHits.map(function (hit) { return hit.render(searchQuery); })),
        overrideHits.map(function (override) { return override.render(searchQuery); })));
}
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    height: 100%;\n    display: flex;\n    flex-direction: column;\n    flex: 1 1 0;\n\n    .search-fragment-highlight {\n      color: ", ";\n      background: transparent;\n    }\n  "], ["\n    height: 100%;\n    display: flex;\n    flex-direction: column;\n    flex: 1 1 0;\n\n    .search-fragment-highlight {\n      color: ", ";\n      background: transparent;\n    }\n  "])), theme.colors.warning.text),
    searchBox: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: column;\n    min-height: 0;\n  "], ["\n    display: flex;\n    flex-direction: column;\n    min-height: 0;\n  "]))),
    formRow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing(1)),
    formBox: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    padding: ", ";\n    background: ", ";\n    border: 1px solid ", ";\n    border-top-left-radius: ", ";\n    border-bottom: none;\n  "], ["\n    padding: ", ";\n    background: ", ";\n    border: 1px solid ", ";\n    border-top-left-radius: ", ";\n    border-bottom: none;\n  "])), theme.spacing(1), theme.colors.background.primary, theme.components.panel.borderColor, theme.shape.borderRadius(1.5)),
    closeButton: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    margin-left: ", ";\n  "], ["\n    margin-left: ", ";\n  "])), theme.spacing(1)),
    searchHits: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    padding: ", ";\n  "], ["\n    padding: ", ";\n  "])), theme.spacing(1, 1, 0, 1)),
    scrollWrapper: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    flex-grow: 1;\n    min-height: 0;\n  "], ["\n    flex-grow: 1;\n    min-height: 0;\n  "]))),
    searchNotice: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    font-size: ", ";\n    color: ", ";\n    padding: ", ";\n    text-align: center;\n  "], ["\n    font-size: ", ";\n    color: ", ";\n    padding: ", ";\n    text-align: center;\n  "])), theme.typography.size.sm, theme.colors.text.secondary, theme.spacing(1)),
    mainBox: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    background: ", ";\n    border: 1px solid ", ";\n    border-top: none;\n    flex-grow: 1;\n  "], ["\n    background: ", ";\n    border: 1px solid ", ";\n    border-top: none;\n    flex-grow: 1;\n  "])), theme.colors.background.primary, theme.components.panel.borderColor),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=OptionsPaneOptions.js.map