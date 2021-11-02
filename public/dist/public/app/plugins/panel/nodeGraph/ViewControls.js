import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { Button, HorizontalGroup, useStyles, VerticalGroup } from '@grafana/ui';
import { css } from '@emotion/css';
function getStyles() {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: wrapper;\n      pointer-events: all;\n    "], ["\n      label: wrapper;\n      pointer-events: all;\n    "]))),
    };
}
/**
 * Control buttons for zoom but also some layout config inputs mainly for debugging.
 */
export function ViewControls(props) {
    var config = props.config, onConfigChange = props.onConfigChange, onPlus = props.onPlus, onMinus = props.onMinus, disableZoomOut = props.disableZoomOut, disableZoomIn = props.disableZoomIn;
    var _a = __read(useState(false), 2), showConfig = _a[0], setShowConfig = _a[1];
    // For debugging the layout, should be removed here and maybe moved to panel config later on
    var allowConfiguration = false;
    var styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(VerticalGroup, { spacing: "sm" },
            React.createElement(HorizontalGroup, { spacing: "xs" },
                React.createElement(Button, { icon: 'plus-circle', onClick: onPlus, size: 'md', title: 'Zoom in', variant: "secondary", disabled: disableZoomIn }),
                React.createElement(Button, { icon: 'minus-circle', onClick: onMinus, size: 'md', title: 'Zoom out', variant: "secondary", disabled: disableZoomOut })),
            React.createElement(HorizontalGroup, { spacing: "xs" },
                React.createElement(Button, { icon: 'code-branch', onClick: function () { return onConfigChange(__assign(__assign({}, config), { gridLayout: false })); }, size: 'md', title: 'Default layout', variant: "secondary", disabled: !config.gridLayout }),
                React.createElement(Button, { icon: 'apps', onClick: function () { return onConfigChange(__assign(__assign({}, config), { gridLayout: true })); }, size: 'md', title: 'Grid layout', variant: "secondary", disabled: config.gridLayout }))),
        allowConfiguration && (React.createElement(Button, { size: 'xs', variant: 'link', onClick: function () { return setShowConfig(function (showConfig) { return !showConfig; }); } }, showConfig ? 'Hide config' : 'Show config')),
        allowConfiguration &&
            showConfig &&
            Object.keys(config)
                .filter(function (k) { return k !== 'show'; })
                .map(function (k) { return (React.createElement("div", { key: k },
                k,
                React.createElement("input", { style: { width: 50 }, type: 'number', value: config[k], onChange: function (e) {
                        var _a;
                        onConfigChange(__assign(__assign({}, config), (_a = {}, _a[k] = parseFloat(e.target.value), _a)));
                    } }))); })));
}
var templateObject_1;
//# sourceMappingURL=ViewControls.js.map