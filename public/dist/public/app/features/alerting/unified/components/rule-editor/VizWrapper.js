import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';
import { PanelRenderer } from '@grafana/runtime';
import { PanelContextProvider, useStyles2 } from '@grafana/ui';
import { useVizHeight } from '../../hooks/useVizHeight';
import { PanelPluginsButtonGroup } from '../PanelPluginsButtonGroup';
import appEvents from 'app/core/app_events';
export var VizWrapper = function (_a) {
    var data = _a.data, currentPanel = _a.currentPanel, changePanel = _a.changePanel, onThresholdsChange = _a.onThresholdsChange, thresholds = _a.thresholds;
    var _b = __read(useState({
        frameIndex: 0,
        showHeader: true,
    }), 2), options = _b[0], setOptions = _b[1];
    var vizHeight = useVizHeight(data, currentPanel, options.frameIndex);
    var styles = useStyles2(getStyles(vizHeight));
    var _c = __read(useState(defaultFieldConfig(thresholds)), 2), fieldConfig = _c[0], setFieldConfig = _c[1];
    useEffect(function () {
        setFieldConfig(function (fieldConfig) { return (__assign(__assign({}, fieldConfig), { defaults: __assign(__assign({}, fieldConfig.defaults), { thresholds: thresholds, custom: __assign(__assign({}, fieldConfig.defaults.custom), { thresholdsStyle: {
                        mode: 'line',
                    } }) }) })); });
    }, [thresholds, setFieldConfig]);
    var context = useMemo(function () { return ({
        eventBus: appEvents,
        canEditThresholds: true,
        onThresholdsChange: onThresholdsChange,
    }); }, [onThresholdsChange]);
    if (!options || !data) {
        return null;
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.buttonGroup },
            React.createElement(PanelPluginsButtonGroup, { onChange: changePanel, value: currentPanel })),
        React.createElement(AutoSizer, null, function (_a) {
            var width = _a.width;
            if (width === 0) {
                return null;
            }
            return (React.createElement("div", { style: { height: vizHeight + "px", width: width + "px" } },
                React.createElement(PanelContextProvider, { value: context },
                    React.createElement(PanelRenderer, { height: vizHeight, width: width, data: data, pluginId: currentPanel, title: "title", onOptionsChange: setOptions, options: options, fieldConfig: fieldConfig }))));
        })));
};
var getStyles = function (visHeight) { return function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: 0 ", ";\n    height: ", "px;\n  "], ["\n    padding: 0 ", ";\n    height: ", "px;\n  "])), theme.spacing(2), visHeight + theme.spacing.gridSize * 4),
    buttonGroup: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    justify-content: flex-end;\n  "], ["\n    display: flex;\n    justify-content: flex-end;\n  "]))),
}); }; };
function defaultFieldConfig(thresholds) {
    if (!thresholds) {
        return { defaults: {}, overrides: [] };
    }
    return {
        defaults: {
            thresholds: thresholds,
            custom: {
                thresholdsStyle: {
                    mode: 'line',
                },
            },
        },
        overrides: [],
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=VizWrapper.js.map