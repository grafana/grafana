import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { LoadingState } from '@grafana/data';
import { Icon, Tooltip, useStyles } from '@grafana/ui';
export var PanelHeaderLoadingIndicator = function (_a) {
    var state = _a.state, onClick = _a.onClick;
    var styles = useStyles(getStyles);
    if (state === LoadingState.Loading) {
        return (React.createElement("div", { className: "panel-loading", onClick: onClick },
            React.createElement(Tooltip, { content: "Cancel query" },
                React.createElement(Icon, { className: "panel-loading__spinner spin-clockwise", name: "sync" }))));
    }
    if (state === LoadingState.Streaming) {
        return (React.createElement("div", { className: "panel-loading", onClick: onClick },
            React.createElement("div", { title: "Streaming (click to stop)", className: styles.streamIndicator })));
    }
    return null;
};
function getStyles(theme) {
    return {
        streamIndicator: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 10px;\n      height: 10px;\n      background: ", ";\n      box-shadow: 0 0 2px ", ";\n      border-radius: 50%;\n      position: relative;\n      top: 6px;\n      right: 1px;\n    "], ["\n      width: 10px;\n      height: 10px;\n      background: ", ";\n      box-shadow: 0 0 2px ", ";\n      border-radius: 50%;\n      position: relative;\n      top: 6px;\n      right: 1px;\n    "])), theme.colors.textFaint, theme.colors.textFaint),
    };
}
var templateObject_1;
//# sourceMappingURL=PanelHeaderLoadingIndicator.js.map