import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Utils & Services
import { getAngularLoader } from 'app/core/services/AngularLoader';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { updateLocation } from 'app/core/actions';
// Components
import { EditorTabBody } from './EditorTabBody';
import { VizTypePicker } from './VizTypePicker';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { FadeIn } from 'app/core/components/Animations/FadeIn';
import { VizPickerSearch } from './VizPickerSearch';
var VisualizationTab = /** @class */ (function (_super) {
    tslib_1.__extends(VisualizationTab, _super);
    function VisualizationTab(props) {
        var _this = _super.call(this, props) || this;
        _this.getReactPanelOptions = function () {
            var _a = _this.props, panel = _a.panel, plugin = _a.plugin;
            return panel.getOptions(plugin.exports.reactPanel.defaults);
        };
        _this.clearQuery = function () {
            _this.setState({ searchQuery: '' });
        };
        _this.onPanelOptionsChanged = function (options) {
            _this.props.panel.updateOptions(options);
            _this.forceUpdate();
        };
        _this.onOpenVizPicker = function () {
            _this.setState({ isVizPickerOpen: true, scrollTop: 0 });
        };
        _this.onCloseVizPicker = function () {
            if (_this.props.urlOpenVizPicker) {
                _this.props.updateLocation({ query: { openVizPicker: null }, partial: true });
            }
            _this.setState({ isVizPickerOpen: false, hasBeenFocused: false });
        };
        _this.onSearchQueryChange = function (value) {
            _this.setState({
                searchQuery: value,
            });
        };
        _this.renderToolbar = function () {
            var plugin = _this.props.plugin;
            var _a = _this.state, isVizPickerOpen = _a.isVizPickerOpen, searchQuery = _a.searchQuery;
            if (isVizPickerOpen) {
                return (React.createElement(VizPickerSearch, { plugin: plugin, searchQuery: searchQuery, onChange: _this.onSearchQueryChange, onClose: _this.onCloseVizPicker }));
            }
            else {
                return (React.createElement("div", { className: "toolbar__main", onClick: _this.onOpenVizPicker },
                    React.createElement("img", { className: "toolbar__main-image", src: plugin.info.logos.small }),
                    React.createElement("div", { className: "toolbar__main-name" }, plugin.name),
                    React.createElement("i", { className: "fa fa-caret-down" })));
            }
        };
        _this.onTypeChanged = function (plugin) {
            if (plugin.id === _this.props.plugin.id) {
                _this.setState({ isVizPickerOpen: false });
            }
            else {
                _this.props.onTypeChanged(plugin);
            }
        };
        _this.renderHelp = function () { return React.createElement(PluginHelp, { plugin: _this.props.plugin, type: "help" }); };
        _this.setScrollTop = function (event) {
            var target = event.target;
            _this.setState({ scrollTop: target.scrollTop });
        };
        _this.state = {
            isVizPickerOpen: _this.props.urlOpenVizPicker,
            hasBeenFocused: false,
            searchQuery: '',
            scrollTop: 0,
        };
        return _this;
    }
    VisualizationTab.prototype.renderPanelOptions = function () {
        var _this = this;
        var _a = this.props, plugin = _a.plugin, angularPanel = _a.angularPanel;
        if (angularPanel) {
            return React.createElement("div", { ref: function (element) { return (_this.element = element); } });
        }
        if (plugin.exports.reactPanel) {
            var PanelEditor = plugin.exports.reactPanel.editor;
            if (PanelEditor) {
                return React.createElement(PanelEditor, { options: this.getReactPanelOptions(), onOptionsChange: this.onPanelOptionsChanged });
            }
        }
        return React.createElement("p", null, "Visualization has no options");
    };
    VisualizationTab.prototype.componentDidMount = function () {
        if (this.shouldLoadAngularOptions()) {
            this.loadAngularOptions();
        }
    };
    VisualizationTab.prototype.componentDidUpdate = function (prevProps) {
        if (this.props.plugin !== prevProps.plugin) {
            this.cleanUpAngularOptions();
        }
        if (this.shouldLoadAngularOptions()) {
            this.loadAngularOptions();
        }
    };
    VisualizationTab.prototype.shouldLoadAngularOptions = function () {
        return this.props.angularPanel && this.element && !this.angularOptions;
    };
    VisualizationTab.prototype.loadAngularOptions = function () {
        var _this = this;
        var angularPanel = this.props.angularPanel;
        var scope = angularPanel.getScope();
        // When full page reloading in edit mode the angular panel has on fully compiled & instantiated yet
        if (!scope.$$childHead) {
            setTimeout(function () {
                _this.forceUpdate();
            });
            return;
        }
        var panelCtrl = scope.$$childHead.ctrl;
        panelCtrl.initEditMode();
        var template = '';
        for (var i = 0; i < panelCtrl.editorTabs.length; i++) {
            template +=
                "\n      <div class=\"panel-options-group\" ng-cloak>" +
                    (i > 0
                        ? "<div class=\"panel-options-group__header\">\n           <span class=\"panel-options-group__title\">{{ctrl.editorTabs[" + i + "].title}}\n           </span>\n         </div>"
                        : '') +
                    ("<div class=\"panel-options-group__body\">\n          <panel-editor-tab editor-tab=\"ctrl.editorTabs[" + i + "]\" ctrl=\"ctrl\"></panel-editor-tab>\n        </div>\n      </div>\n      ");
        }
        var loader = getAngularLoader();
        var scopeProps = { ctrl: panelCtrl };
        this.angularOptions = loader.load(this.element, scopeProps, template);
    };
    VisualizationTab.prototype.componentWillUnmount = function () {
        this.cleanUpAngularOptions();
    };
    VisualizationTab.prototype.cleanUpAngularOptions = function () {
        if (this.angularOptions) {
            this.angularOptions.destroy();
            this.angularOptions = null;
        }
    };
    VisualizationTab.prototype.render = function () {
        var plugin = this.props.plugin;
        var _a = this.state, isVizPickerOpen = _a.isVizPickerOpen, searchQuery = _a.searchQuery, scrollTop = _a.scrollTop;
        var pluginHelp = {
            heading: 'Help',
            icon: 'fa fa-question',
            render: this.renderHelp,
        };
        return (React.createElement(EditorTabBody, { heading: "Visualization", renderToolbar: this.renderToolbar, toolbarItems: [pluginHelp], scrollTop: scrollTop, setScrollTop: this.setScrollTop },
            React.createElement(React.Fragment, null,
                React.createElement(FadeIn, { in: isVizPickerOpen, duration: 200, unmountOnExit: true, onExited: this.clearQuery },
                    React.createElement(VizTypePicker, { current: plugin, onTypeChanged: this.onTypeChanged, searchQuery: searchQuery, onClose: this.onCloseVizPicker })),
                this.renderPanelOptions())));
    };
    return VisualizationTab;
}(PureComponent));
export { VisualizationTab };
var mapStateToProps = function (state) { return ({
    urlOpenVizPicker: !!state.location.query.openVizPicker,
}); };
var mapDispatchToProps = {
    updateLocation: updateLocation,
};
export default connectWithStore(VisualizationTab, mapStateToProps, mapDispatchToProps);
//# sourceMappingURL=VisualizationTab.js.map