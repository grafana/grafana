import * as tslib_1 from "tslib";
import React from 'react';
import { PopperController, Popper } from '@grafana/ui';
import rst2html from 'rst2html';
import { FunctionEditorControls } from './FunctionEditorControls';
var FunctionEditor = /** @class */ (function (_super) {
    tslib_1.__extends(FunctionEditor, _super);
    function FunctionEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.triggerRef = React.createRef();
        _this.renderContent = function (_a) {
            var updatePopperPosition = _a.updatePopperPosition;
            var _b = _this.props, onMoveLeft = _b.onMoveLeft, onMoveRight = _b.onMoveRight, _c = _b.func.def, name = _c.name, description = _c.description;
            var showingDescription = _this.state.showingDescription;
            if (showingDescription) {
                return (React.createElement("div", { style: { overflow: 'auto', maxHeight: '30rem', textAlign: 'left', fontWeight: 'normal' } },
                    React.createElement("h4", { style: { color: 'white' } },
                        " ",
                        name,
                        " "),
                    React.createElement("div", { dangerouslySetInnerHTML: {
                            __html: rst2html(description),
                        } })));
            }
            return (React.createElement(FunctionEditorControls, tslib_1.__assign({}, _this.props, { onMoveLeft: function () {
                    onMoveLeft(_this.props.func);
                    updatePopperPosition();
                }, onMoveRight: function () {
                    onMoveRight(_this.props.func);
                    updatePopperPosition();
                }, onDescriptionShow: function () {
                    _this.setState({ showingDescription: true }, function () {
                        updatePopperPosition();
                    });
                } })));
        };
        _this.state = {
            showingDescription: false,
        };
        return _this;
    }
    FunctionEditor.prototype.render = function () {
        var _this = this;
        return (React.createElement(PopperController, { content: this.renderContent, placement: "top", hideAfter: 300 }, function (showPopper, hidePopper, popperProps) {
            return (React.createElement(React.Fragment, null,
                _this.triggerRef && (React.createElement(Popper, tslib_1.__assign({}, popperProps, { referenceElement: _this.triggerRef.current, wrapperClassName: "popper", className: "popper__background", onMouseLeave: function () {
                        _this.setState({ showingDescription: false });
                        hidePopper();
                    }, onMouseEnter: showPopper, renderArrow: function (_a) {
                        var arrowProps = _a.arrowProps, placement = _a.placement;
                        return (React.createElement("div", tslib_1.__assign({ className: "popper__arrow", "data-placement": placement }, arrowProps)));
                    } }))),
                React.createElement("span", { ref: _this.triggerRef, onClick: popperProps.show ? hidePopper : showPopper, onMouseLeave: function () {
                        hidePopper();
                        _this.setState({ showingDescription: false });
                    }, style: { cursor: 'pointer' } }, _this.props.func.def.name)));
        }));
    };
    return FunctionEditor;
}(React.PureComponent));
export { FunctionEditor };
//# sourceMappingURL=FunctionEditor.js.map