import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Components
import { CustomScrollbar, PanelOptionsGroup } from '@grafana/ui';
import { FadeIn } from 'app/core/components/Animations/FadeIn';
var EditorTabBody = /** @class */ (function (_super) {
    tslib_1.__extends(EditorTabBody, _super);
    function EditorTabBody(props) {
        var _this = _super.call(this, props) || this;
        _this.onToggleToolBarView = function (item) {
            _this.setState({
                openView: item,
                isOpen: _this.state.openView !== item || !_this.state.isOpen,
            });
        };
        _this.onCloseOpenView = function () {
            _this.setState({ isOpen: false });
        };
        _this.state = {
            openView: null,
            fadeIn: false,
            isOpen: false,
        };
        return _this;
    }
    EditorTabBody.prototype.componentDidMount = function () {
        this.setState({ fadeIn: true });
    };
    EditorTabBody.getDerivedStateFromProps = function (props, state) {
        if (state.openView) {
            var activeToolbarItem = props.toolbarItems.find(function (item) { return item.title === state.openView.title && item.icon === state.openView.icon; });
            if (activeToolbarItem) {
                return tslib_1.__assign({}, state, { openView: activeToolbarItem });
            }
        }
        return state;
    };
    EditorTabBody.prototype.renderButton = function (view) {
        var _this = this;
        var onClick = function () {
            if (view.onClick) {
                view.onClick();
            }
            if (view.render) {
                _this.onToggleToolBarView(view);
            }
        };
        return (React.createElement("div", { className: "nav-buttons", key: view.title + view.icon },
            React.createElement("button", { className: "btn navbar-button", onClick: onClick, disabled: view.disabled },
                view.icon && React.createElement("i", { className: view.icon }),
                " ",
                view.title)));
    };
    EditorTabBody.prototype.renderOpenView = function (view) {
        return (React.createElement(PanelOptionsGroup, { title: view.title || view.heading, onClose: this.onCloseOpenView }, view.render()));
    };
    EditorTabBody.prototype.render = function () {
        var _this = this;
        var _a = this.props, children = _a.children, renderToolbar = _a.renderToolbar, heading = _a.heading, toolbarItems = _a.toolbarItems, scrollTop = _a.scrollTop, setScrollTop = _a.setScrollTop;
        var _b = this.state, openView = _b.openView, fadeIn = _b.fadeIn, isOpen = _b.isOpen;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "toolbar" },
                React.createElement("div", { className: "toolbar__left" },
                    React.createElement("div", { className: "toolbar__heading" }, heading),
                    renderToolbar && renderToolbar()),
                toolbarItems.map(function (item) { return _this.renderButton(item); })),
            React.createElement("div", { className: "panel-editor__scroll" },
                React.createElement(CustomScrollbar, { autoHide: false, scrollTop: scrollTop, setScrollTop: setScrollTop, updateAfterMountMs: 300 },
                    React.createElement("div", { className: "panel-editor__content" },
                        React.createElement(FadeIn, { in: isOpen, duration: 200, unmountOnExit: true }, openView && this.renderOpenView(openView)),
                        React.createElement(FadeIn, { in: fadeIn, duration: 50 }, children))))));
    };
    EditorTabBody.defaultProps = {
        toolbarItems: [],
    };
    return EditorTabBody;
}(PureComponent));
export { EditorTabBody };
//# sourceMappingURL=EditorTabBody.js.map