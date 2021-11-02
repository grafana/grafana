import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { css, cx } from '@emotion/css';
import { Counter, Icon, useStyles2 } from '@grafana/ui';
import { PANEL_EDITOR_UI_STATE_STORAGE_KEY } from './state/reducers';
import { useLocalStorage } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
var CATEGORY_PARAM_NAME = 'showCategory';
export var OptionsPaneCategory = React.memo(function (_a) {
    var _b, _c, _d;
    var _e;
    var id = _a.id, title = _a.title, children = _a.children, forceOpen = _a.forceOpen, isOpenDefault = _a.isOpenDefault, renderTitle = _a.renderTitle, className = _a.className, itemsCount = _a.itemsCount, _f = _a.isNested, isNested = _f === void 0 ? false : _f;
    var initialIsExpanded = isOpenDefault !== false;
    var _g = __read(useLocalStorage(getOptionGroupStorageKey(id), {
        isExpanded: initialIsExpanded,
    }), 2), savedState = _g[0], setSavedState = _g[1];
    var styles = useStyles2(getStyles);
    var _h = __read(useQueryParams(), 2), queryParams = _h[0], updateQueryParams = _h[1];
    var _j = __read(useState((_e = savedState === null || savedState === void 0 ? void 0 : savedState.isExpanded) !== null && _e !== void 0 ? _e : initialIsExpanded), 2), isExpanded = _j[0], setIsExpanded = _j[1];
    var manualClickTime = useRef(0);
    var ref = useRef(null);
    var isOpenFromUrl = queryParams[CATEGORY_PARAM_NAME] === id;
    useEffect(function () {
        var _a;
        if (manualClickTime.current) {
            // ignore changes since the click handled the expected behavior
            if (Date.now() - manualClickTime.current < 200) {
                return;
            }
        }
        if (isOpenFromUrl || forceOpen) {
            if (!isExpanded) {
                setIsExpanded(true);
            }
            if (isOpenFromUrl) {
                (_a = ref.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView();
            }
        }
    }, [forceOpen, isExpanded, isOpenFromUrl]);
    var onToggle = useCallback(function () {
        var _a;
        manualClickTime.current = Date.now();
        updateQueryParams((_a = {},
            _a[CATEGORY_PARAM_NAME] = isExpanded ? undefined : id,
            _a));
        setSavedState({ isExpanded: !isExpanded });
        setIsExpanded(!isExpanded);
    }, [setSavedState, setIsExpanded, updateQueryParams, isExpanded, id]);
    if (!renderTitle) {
        renderTitle = function defaultTitle(isExpanded) {
            if (isExpanded || itemsCount === undefined || itemsCount === 0) {
                return title;
            }
            return (React.createElement("span", null,
                title,
                " ",
                React.createElement(Counter, { value: itemsCount })));
        };
    }
    var boxStyles = cx((_b = {},
        _b[styles.box] = true,
        _b[styles.boxNestedExpanded] = isNested && isExpanded,
        _b), className, 'options-group');
    var headerStyles = cx(styles.header, (_c = {},
        _c[styles.headerExpanded] = isExpanded,
        _c[styles.headerNested] = isNested,
        _c));
    var bodyStyles = cx(styles.body, (_d = {},
        _d[styles.bodyNested] = isNested,
        _d));
    return (React.createElement("div", { className: boxStyles, "data-testid": "options-category", "aria-label": selectors.components.OptionsGroup.group(id), ref: ref },
        React.createElement("div", { className: headerStyles, onClick: onToggle, "aria-label": selectors.components.OptionsGroup.toggle(id) },
            React.createElement("div", { className: cx(styles.toggle, 'editor-options-group-toggle') },
                React.createElement(Icon, { name: isExpanded ? 'angle-down' : 'angle-right' })),
            React.createElement("h6", { className: styles.title }, renderTitle(isExpanded))),
        isExpanded && React.createElement("div", { className: bodyStyles }, children)));
});
var getStyles = function (theme) {
    return {
        box: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      border-top: 1px solid ", ";\n    "], ["\n      border-top: 1px solid ", ";\n    "])), theme.colors.border.weak),
        boxNestedExpanded: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(2)),
        toggle: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      color: ", ";\n      margin-right: ", ";\n    "], ["\n      color: ", ";\n      margin-right: ", ";\n    "])), theme.colors.text.secondary, theme.spacing(1)),
        title: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      flex-grow: 1;\n      overflow: hidden;\n      line-height: 1.5;\n      font-size: 1rem;\n      font-weight: ", ";\n      margin: 0;\n    "], ["\n      flex-grow: 1;\n      overflow: hidden;\n      line-height: 1.5;\n      font-size: 1rem;\n      font-weight: ", ";\n      margin: 0;\n    "])), theme.typography.fontWeightMedium),
        header: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      cursor: pointer;\n      align-items: baseline;\n      padding: ", ";\n      color: ", ";\n      font-weight: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      display: flex;\n      cursor: pointer;\n      align-items: baseline;\n      padding: ", ";\n      color: ", ";\n      font-weight: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.spacing(1), theme.colors.text.primary, theme.typography.fontWeightMedium, theme.colors.emphasize(theme.colors.background.primary, 0.03)),
        headerExpanded: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.text.primary),
        headerNested: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing(0.5, 0, 0.5, 0)),
        body: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing(1, 2, 1, 4)),
        bodyNested: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      position: relative;\n      padding-right: 0;\n      &:before {\n        content: '';\n        position: absolute;\n        top: 0;\n        left: 8px;\n        width: 1px;\n        height: 100%;\n        background: ", ";\n      }\n    "], ["\n      position: relative;\n      padding-right: 0;\n      &:before {\n        content: '';\n        position: absolute;\n        top: 0;\n        left: 8px;\n        width: 1px;\n        height: 100%;\n        background: ", ";\n      }\n    "])), theme.colors.border.weak),
    };
};
var getOptionGroupStorageKey = function (id) { return PANEL_EDITOR_UI_STATE_STORAGE_KEY + ".optionGroup[" + id + "]"; };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=OptionsPaneCategory.js.map