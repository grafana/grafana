import { __extends, __makeTemplateObject } from "tslib";
import React, { createRef, PureComponent } from 'react';
import SplitPane from 'react-split-pane';
import { css, cx } from '@emotion/css';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
var Pane;
(function (Pane) {
    Pane[Pane["Right"] = 0] = "Right";
    Pane[Pane["Top"] = 1] = "Top";
})(Pane || (Pane = {}));
var SplitPaneWrapper = /** @class */ (function (_super) {
    __extends(SplitPaneWrapper, _super);
    function SplitPaneWrapper() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.rafToken = createRef();
        _this.updateSplitPaneSize = function () {
            if (_this.rafToken.current !== undefined) {
                window.cancelAnimationFrame(_this.rafToken.current);
            }
            _this.rafToken.current = window.requestAnimationFrame(function () {
                _this.forceUpdate();
            });
        };
        _this.onDragFinished = function (pane, size) {
            document.body.style.cursor = 'auto';
            // When the drag handle is just clicked size is undefined
            if (!size) {
                return;
            }
            var updateUiState = _this.props.updateUiState;
            if (pane === Pane.Top) {
                updateUiState({
                    topPaneSize: size / window.innerHeight,
                });
            }
            else {
                updateUiState({
                    rightPaneSize: size / window.innerWidth,
                });
            }
        };
        _this.onDragStarted = function () {
            document.body.style.cursor = 'row-resize';
        };
        return _this;
    }
    SplitPaneWrapper.prototype.componentDidMount = function () {
        window.addEventListener('resize', this.updateSplitPaneSize);
    };
    SplitPaneWrapper.prototype.componentWillUnmount = function () {
        window.removeEventListener('resize', this.updateSplitPaneSize);
    };
    SplitPaneWrapper.prototype.renderHorizontalSplit = function () {
        var _this = this;
        var _a = this.props, leftPaneComponents = _a.leftPaneComponents, uiState = _a.uiState;
        var styles = getStyles(config.theme);
        var topPaneSize = uiState.topPaneSize >= 1 ? uiState.topPaneSize : uiState.topPaneSize * window.innerHeight;
        /*
          Guesstimate the height of the browser window minus
          panel toolbar and editor toolbar (~120px). This is to prevent resizing
          the preview window beyond the browser window.
         */
        if (Array.isArray(leftPaneComponents)) {
            return (React.createElement(SplitPane, { split: "horizontal", maxSize: -200, primary: "first", size: topPaneSize, pane2Style: { minHeight: 0 }, resizerClassName: styles.resizerH, onDragStarted: this.onDragStarted, onDragFinished: function (size) { return _this.onDragFinished(Pane.Top, size); } }, leftPaneComponents));
        }
        return leftPaneComponents;
    };
    SplitPaneWrapper.prototype.render = function () {
        var _this = this;
        var _a = this.props, rightPaneVisible = _a.rightPaneVisible, rightPaneComponents = _a.rightPaneComponents, uiState = _a.uiState;
        // Limit options pane width to 90% of screen.
        var styles = getStyles(config.theme);
        // Need to handle when width is relative. ie a percentage of the viewport
        var rightPaneSize = uiState.rightPaneSize <= 1
            ? uiState.rightPaneSize * window.innerWidth
            : uiState.rightPaneSize;
        if (!rightPaneVisible) {
            return this.renderHorizontalSplit();
        }
        return (React.createElement(SplitPane, { split: "vertical", maxSize: -300, size: rightPaneSize, primary: "second", resizerClassName: styles.resizerV, onDragStarted: function () { return (document.body.style.cursor = 'col-resize'); }, onDragFinished: function (size) { return _this.onDragFinished(Pane.Right, size); } },
            this.renderHorizontalSplit(),
            rightPaneComponents));
    };
    SplitPaneWrapper.defaultProps = {
        rightPaneVisible: true,
    };
    return SplitPaneWrapper;
}(PureComponent));
export { SplitPaneWrapper };
var getStyles = stylesFactory(function (theme) {
    var handleColor = theme.palette.blue95;
    var paneSpacing = theme.spacing.md;
    var resizer = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    font-style: italic;\n    background: transparent;\n    border-top: 0;\n    border-right: 0;\n    border-bottom: 0;\n    border-left: 0;\n    border-color: transparent;\n    border-style: solid;\n    transition: 0.2s border-color ease-in-out;\n\n    &:hover {\n      border-color: ", ";\n    }\n  "], ["\n    font-style: italic;\n    background: transparent;\n    border-top: 0;\n    border-right: 0;\n    border-bottom: 0;\n    border-left: 0;\n    border-color: transparent;\n    border-style: solid;\n    transition: 0.2s border-color ease-in-out;\n\n    &:hover {\n      border-color: ", ";\n    }\n  "])), handleColor);
    return {
        resizerV: cx(resizer, css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        cursor: col-resize;\n        width: ", ";\n        border-right-width: 1px;\n        margin-top: 18px;\n      "], ["\n        cursor: col-resize;\n        width: ", ";\n        border-right-width: 1px;\n        margin-top: 18px;\n      "])), paneSpacing)),
        resizerH: cx(resizer, css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        height: ", ";\n        cursor: row-resize;\n        position: relative;\n        top: 0px;\n        z-index: 1;\n        border-top-width: 1px;\n        margin-left: ", ";\n      "], ["\n        height: ", ";\n        cursor: row-resize;\n        position: relative;\n        top: 0px;\n        z-index: 1;\n        border-top-width: 1px;\n        margin-left: ", ";\n      "])), paneSpacing, paneSpacing)),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=SplitPaneWrapper.js.map