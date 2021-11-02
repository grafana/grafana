import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import { mergeMap } from 'rxjs/operators';
import { css } from '@emotion/css';
import { Icon, JSONFormatter, useStyles } from '@grafana/ui';
import { transformDataFrame, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
export var TransformationEditor = function (_a) {
    var debugMode = _a.debugMode, index = _a.index, data = _a.data, uiConfig = _a.uiConfig, configs = _a.configs, onChange = _a.onChange;
    var styles = useStyles(getStyles);
    var _b = __read(useState([]), 2), input = _b[0], setInput = _b[1];
    var _c = __read(useState([]), 2), output = _c[0], setOutput = _c[1];
    var config = useMemo(function () { return configs[index]; }, [configs, index]);
    useEffect(function () {
        var inputTransforms = configs.slice(0, index).map(function (t) { return t.transformation; });
        var outputTransforms = configs.slice(index, index + 1).map(function (t) { return t.transformation; });
        var inputSubscription = transformDataFrame(inputTransforms, data).subscribe(setInput);
        var outputSubscription = transformDataFrame(inputTransforms, data)
            .pipe(mergeMap(function (before) { return transformDataFrame(outputTransforms, before); }))
            .subscribe(setOutput);
        return function unsubscribe() {
            inputSubscription.unsubscribe();
            outputSubscription.unsubscribe();
        };
    }, [index, data, configs]);
    var editor = useMemo(function () {
        return React.createElement(uiConfig.editor, {
            options: __assign(__assign({}, uiConfig.transformation.defaultOptions), config.transformation.options),
            input: input,
            onChange: function (opts) {
                onChange(index, { id: config.transformation.id, options: opts });
            },
        });
    }, [
        uiConfig.editor,
        uiConfig.transformation.defaultOptions,
        config.transformation.options,
        config.transformation.id,
        input,
        onChange,
        index,
    ]);
    return (React.createElement("div", { className: styles.editor, "aria-label": selectors.components.TransformTab.transformationEditor(uiConfig.name) },
        editor,
        debugMode && (React.createElement("div", { className: styles.debugWrapper, "aria-label": selectors.components.TransformTab.transformationEditorDebugger(uiConfig.name) },
            React.createElement("div", { className: styles.debug },
                React.createElement("div", { className: styles.debugTitle }, "Transformation input data"),
                React.createElement("div", { className: styles.debugJson },
                    React.createElement(JSONFormatter, { json: input }))),
            React.createElement("div", { className: styles.debugSeparator },
                React.createElement(Icon, { name: "arrow-right" })),
            React.createElement("div", { className: styles.debug },
                React.createElement("div", { className: styles.debugTitle }, "Transformation output data"),
                React.createElement("div", { className: styles.debugJson }, output && React.createElement(JSONFormatter, { json: output })))))));
};
var getStyles = function (theme) {
    var debugBorder = theme.isLight ? theme.palette.gray85 : theme.palette.gray15;
    return {
        title: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      padding: 4px 8px 4px 8px;\n      position: relative;\n      height: 35px;\n      border-radius: 4px 4px 0 0;\n      flex-wrap: nowrap;\n      justify-content: space-between;\n      align-items: center;\n    "], ["\n      display: flex;\n      padding: 4px 8px 4px 8px;\n      position: relative;\n      height: 35px;\n      border-radius: 4px 4px 0 0;\n      flex-wrap: nowrap;\n      justify-content: space-between;\n      align-items: center;\n    "]))),
        name: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      font-weight: ", ";\n      color: ", ";\n    "], ["\n      font-weight: ", ";\n      color: ", ";\n    "])), theme.typography.weight.semibold, theme.colors.textBlue),
        iconRow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        icon: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      background: transparent;\n      border: none;\n      box-shadow: none;\n      cursor: pointer;\n      color: ", ";\n      margin-left: ", ";\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      background: transparent;\n      border: none;\n      box-shadow: none;\n      cursor: pointer;\n      color: ", ";\n      margin-left: ", ";\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.colors.textWeak, theme.spacing.sm, theme.colors.text),
        editor: css(templateObject_5 || (templateObject_5 = __makeTemplateObject([""], [""]))),
        debugWrapper: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n    "], ["\n      display: flex;\n      flex-direction: row;\n    "]))),
        debugSeparator: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      width: 48px;\n      min-height: 300px;\n      display: flex;\n      align-items: center;\n      align-self: stretch;\n      justify-content: center;\n      margin: 0 ", ";\n      color: ", ";\n    "], ["\n      width: 48px;\n      min-height: 300px;\n      display: flex;\n      align-items: center;\n      align-self: stretch;\n      justify-content: center;\n      margin: 0 ", ";\n      color: ", ";\n    "])), theme.spacing.xs, theme.colors.textBlue),
        debugTitle: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      padding: ", " ", ";\n      font-family: ", ";\n      font-size: ", ";\n      color: ", ";\n      border-bottom: 1px solid ", ";\n      flex-grow: 0;\n      flex-shrink: 1;\n    "], ["\n      padding: ", " ", ";\n      font-family: ", ";\n      font-size: ", ";\n      color: ", ";\n      border-bottom: 1px solid ", ";\n      flex-grow: 0;\n      flex-shrink: 1;\n    "])), theme.spacing.sm, theme.spacing.xxs, theme.typography.fontFamily.monospace, theme.typography.size.sm, theme.colors.text, debugBorder),
        debug: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      margin-top: ", ";\n      padding: 0 ", " ", " ", ";\n      border: 1px solid ", ";\n      background: ", ";\n      border-radius: ", ";\n      width: 100%;\n      min-height: 300px;\n      display: flex;\n      flex-direction: column;\n      align-self: stretch;\n    "], ["\n      margin-top: ", ";\n      padding: 0 ", " ", " ", ";\n      border: 1px solid ", ";\n      background: ", ";\n      border-radius: ", ";\n      width: 100%;\n      min-height: 300px;\n      display: flex;\n      flex-direction: column;\n      align-self: stretch;\n    "])), theme.spacing.sm, theme.spacing.sm, theme.spacing.sm, theme.spacing.sm, debugBorder, theme.isLight ? theme.palette.white : theme.palette.gray05, theme.border.radius.sm),
        debugJson: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      flex-grow: 1;\n      height: 100%;\n      overflow: hidden;\n      padding: ", ";\n    "], ["\n      flex-grow: 1;\n      height: 100%;\n      overflow: hidden;\n      padding: ", ";\n    "])), theme.spacing.xs),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
//# sourceMappingURL=TransformationEditor.js.map