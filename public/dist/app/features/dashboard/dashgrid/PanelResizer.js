import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { throttle } from 'lodash';
import Draggable from 'react-draggable';
var PanelResizer = /** @class */ (function (_super) {
    tslib_1.__extends(PanelResizer, _super);
    function PanelResizer(props) {
        var _this = _super.call(this, props) || this;
        _this.initialHeight = Math.floor(document.documentElement.scrollHeight * 0.3);
        _this.noStyles = {};
        _this.changeHeight = function (height) {
            var sh = _this.smallestHeight;
            var lh = _this.largestHeight;
            height = height < sh ? sh : height;
            height = height > lh ? lh : height;
            _this.prevEditorHeight = _this.state.editorHeight;
            _this.setState({
                editorHeight: height,
            });
        };
        _this.onDrag = function (evt, data) {
            var newHeight = _this.state.editorHeight + data.y;
            _this.throttledChangeHeight(newHeight);
            _this.throttledResizeDone();
        };
        var panel = _this.props.panel;
        _this.state = {
            editorHeight: _this.initialHeight,
        };
        _this.throttledChangeHeight = throttle(_this.changeHeight, 20, { trailing: true });
        _this.throttledResizeDone = throttle(function () {
            panel.resizeDone();
        }, 50);
        return _this;
    }
    Object.defineProperty(PanelResizer.prototype, "largestHeight", {
        get: function () {
            return document.documentElement.scrollHeight * 0.9;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PanelResizer.prototype, "smallestHeight", {
        get: function () {
            return 100;
        },
        enumerable: true,
        configurable: true
    });
    PanelResizer.prototype.render = function () {
        var _a = this.props, render = _a.render, isEditing = _a.isEditing;
        var editorHeight = this.state.editorHeight;
        return (React.createElement(React.Fragment, null,
            render(isEditing ? { height: editorHeight } : this.noStyles),
            isEditing && (React.createElement("div", { className: "panel-editor-container__resizer" },
                React.createElement(Draggable, { axis: "y", grid: [100, 1], onDrag: this.onDrag, position: { x: 0, y: 0 } },
                    React.createElement("div", { className: "panel-editor-resizer" },
                        React.createElement("div", { className: "panel-editor-resizer__handle" })))))));
    };
    return PanelResizer;
}(PureComponent));
export { PanelResizer };
//# sourceMappingURL=PanelResizer.js.map