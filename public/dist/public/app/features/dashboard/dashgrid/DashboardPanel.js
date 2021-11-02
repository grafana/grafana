import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { PanelChrome } from './PanelChrome';
import { PanelChromeAngular } from './PanelChromeAngular';
import { cleanUpPanelState, setPanelInstanceState } from '../../panel/state/reducers';
import { initPanelState } from '../../panel/state/actions';
var mapStateToProps = function (state, props) {
    var panelState = state.panels[props.stateKey];
    if (!panelState) {
        return { plugin: null };
    }
    return {
        plugin: panelState.plugin,
        instanceState: panelState.instanceState,
    };
};
var mapDispatchToProps = {
    initPanelState: initPanelState,
    cleanUpPanelState: cleanUpPanelState,
    setPanelInstanceState: setPanelInstanceState,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var DashboardPanelUnconnected = /** @class */ (function (_super) {
    __extends(DashboardPanelUnconnected, _super);
    function DashboardPanelUnconnected(props) {
        var _this = _super.call(this, props) || this;
        _this.specialPanels = {};
        _this.onInstanceStateChange = function (value) {
            _this.props.setPanelInstanceState({ key: _this.props.stateKey, value: value });
        };
        _this.state = {
            isLazy: !props.isInView,
        };
        return _this;
    }
    DashboardPanelUnconnected.prototype.componentDidMount = function () {
        if (!this.props.plugin) {
            this.props.initPanelState(this.props.panel);
        }
    };
    DashboardPanelUnconnected.prototype.componentWillUnmount = function () {
        // Most of the time an unmount should result in cleanup but in PanelEdit it should not
        if (!this.props.skipStateCleanUp) {
            this.props.cleanUpPanelState({ key: this.props.stateKey });
        }
    };
    DashboardPanelUnconnected.prototype.componentDidUpdate = function () {
        if (this.state.isLazy && this.props.isInView) {
            this.setState({ isLazy: false });
        }
    };
    DashboardPanelUnconnected.prototype.renderPanel = function (plugin) {
        var _a = this.props, dashboard = _a.dashboard, panel = _a.panel, isViewing = _a.isViewing, isInView = _a.isInView, isEditing = _a.isEditing, width = _a.width, height = _a.height;
        if (plugin.angularPanelCtrl) {
            return (React.createElement(PanelChromeAngular, { plugin: plugin, panel: panel, dashboard: dashboard, isViewing: isViewing, isEditing: isEditing, isInView: isInView, width: width, height: height }));
        }
        return (React.createElement(PanelChrome, { plugin: plugin, panel: panel, dashboard: dashboard, isViewing: isViewing, isEditing: isEditing, isInView: isInView, width: width, height: height, onInstanceStateChange: this.onInstanceStateChange }));
    };
    DashboardPanelUnconnected.prototype.render = function () {
        var plugin = this.props.plugin;
        var isLazy = this.state.isLazy;
        // If we have not loaded plugin exports yet, wait
        if (!plugin) {
            return null;
        }
        // If we are lazy state don't render anything
        if (isLazy) {
            return null;
        }
        return this.renderPanel(plugin);
    };
    return DashboardPanelUnconnected;
}(PureComponent));
export { DashboardPanelUnconnected };
export var DashboardPanel = connector(DashboardPanelUnconnected);
//# sourceMappingURL=DashboardPanel.js.map