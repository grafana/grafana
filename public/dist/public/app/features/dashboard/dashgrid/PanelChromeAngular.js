import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { Subscription } from 'rxjs';
import { connect } from 'react-redux';
import { getAngularLoader, locationService } from '@grafana/runtime';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { PanelHeader } from './PanelHeader/PanelHeader';
import { getTimeSrv } from '../services/TimeSrv';
import { setPanelAngularComponent } from 'app/features/panel/state/reducers';
import config from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { isSoloRoute } from '../../../routes/utils';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
var PanelChromeAngularUnconnected = /** @class */ (function (_super) {
    __extends(PanelChromeAngularUnconnected, _super);
    function PanelChromeAngularUnconnected(props) {
        var _this = _super.call(this, props) || this;
        _this.element = null;
        _this.timeSrv = getTimeSrv();
        _this.subs = new Subscription();
        _this.state = {
            data: {
                state: LoadingState.NotStarted,
                series: [],
                timeRange: getDefaultTimeRange(),
            },
        };
        return _this;
    }
    PanelChromeAngularUnconnected.prototype.componentDidMount = function () {
        var _this = this;
        var panel = this.props.panel;
        this.loadAngularPanel();
        // subscribe to data events
        var queryRunner = panel.getQueryRunner();
        // we are not displaying any of this data so no need for transforms or field config
        this.subs.add(queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
            next: function (data) { return _this.onPanelDataUpdate(data); },
        }));
    };
    PanelChromeAngularUnconnected.prototype.onPanelDataUpdate = function (data) {
        var errorMessage;
        if (data.state === LoadingState.Error) {
            var error = data.error;
            if (error) {
                if (errorMessage !== error.message) {
                    errorMessage = error.message;
                }
            }
        }
        this.setState({ data: data, errorMessage: errorMessage });
    };
    PanelChromeAngularUnconnected.prototype.componentWillUnmount = function () {
        this.subs.unsubscribe();
    };
    PanelChromeAngularUnconnected.prototype.componentDidUpdate = function (prevProps, prevState) {
        var _a = this.props, plugin = _a.plugin, height = _a.height, width = _a.width, panel = _a.panel;
        if (prevProps.plugin !== plugin) {
            this.loadAngularPanel();
        }
        if (prevProps.width !== width || prevProps.height !== height) {
            if (this.scopeProps) {
                this.scopeProps.size.height = this.getInnerPanelHeight();
                this.scopeProps.size.width = this.getInnerPanelWidth();
                panel.render();
            }
        }
    };
    PanelChromeAngularUnconnected.prototype.getInnerPanelHeight = function () {
        var _a = this.props, plugin = _a.plugin, height = _a.height;
        var theme = config.theme;
        var headerHeight = this.hasOverlayHeader() ? 0 : theme.panelHeaderHeight;
        var chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
        return height - headerHeight - chromePadding * 2 - PANEL_BORDER;
    };
    PanelChromeAngularUnconnected.prototype.getInnerPanelWidth = function () {
        var _a = this.props, plugin = _a.plugin, width = _a.width;
        var theme = config.theme;
        var chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
        return width - chromePadding * 2 - PANEL_BORDER;
    };
    PanelChromeAngularUnconnected.prototype.loadAngularPanel = function () {
        var _a = this.props, panel = _a.panel, dashboard = _a.dashboard, setPanelAngularComponent = _a.setPanelAngularComponent;
        // if we have no element or already have loaded the panel return
        if (!this.element) {
            return;
        }
        var loader = getAngularLoader();
        var template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
        this.scopeProps = {
            panel: panel,
            dashboard: dashboard,
            size: { width: this.getInnerPanelWidth(), height: this.getInnerPanelHeight() },
        };
        setPanelAngularComponent({
            key: panel.key,
            angularComponent: loader.load(this.element, this.scopeProps, template),
        });
    };
    PanelChromeAngularUnconnected.prototype.hasOverlayHeader = function () {
        var panel = this.props.panel;
        var data = this.state.data;
        // always show normal header if we have time override
        if (data.request && data.request.timeInfo) {
            return false;
        }
        return !panel.hasTitle();
    };
    PanelChromeAngularUnconnected.prototype.render = function () {
        var _a;
        var _this = this;
        var _b;
        var _c = this.props, dashboard = _c.dashboard, panel = _c.panel, isViewing = _c.isViewing, isEditing = _c.isEditing, plugin = _c.plugin;
        var _d = this.state, errorMessage = _d.errorMessage, data = _d.data;
        var transparent = panel.transparent;
        var alertState = (_b = data.alertState) === null || _b === void 0 ? void 0 : _b.state;
        var containerClassNames = classNames((_a = {
                'panel-container': true,
                'panel-container--absolute': isSoloRoute(locationService.getLocation().pathname),
                'panel-container--transparent': transparent,
                'panel-container--no-title': this.hasOverlayHeader(),
                'panel-has-alert': panel.alert !== undefined
            },
            _a["panel-alert-state--" + alertState] = alertState !== undefined,
            _a));
        var panelContentClassNames = classNames({
            'panel-content': true,
            'panel-content--no-padding': plugin.noPadding,
        });
        return (React.createElement("div", { className: containerClassNames, "aria-label": selectors.components.Panels.Panel.containerByTitle(panel.title) },
            React.createElement(PanelHeader, { panel: panel, dashboard: dashboard, title: panel.title, description: panel.description, links: panel.links, error: errorMessage, isViewing: isViewing, isEditing: isEditing, data: data, alertState: alertState }),
            React.createElement("div", { className: panelContentClassNames },
                React.createElement("div", { ref: function (element) { return (_this.element = element); }, className: "panel-height-helper" }))));
    };
    return PanelChromeAngularUnconnected;
}(PureComponent));
export { PanelChromeAngularUnconnected };
var mapStateToProps = function (state, props) {
    var _a;
    return {
        angularComponent: (_a = getPanelStateForModel(state, props.panel)) === null || _a === void 0 ? void 0 : _a.angularComponent,
    };
};
var mapDispatchToProps = { setPanelAngularComponent: setPanelAngularComponent };
export var PanelChromeAngular = connect(mapStateToProps, mapDispatchToProps)(PanelChromeAngularUnconnected);
//# sourceMappingURL=PanelChromeAngular.js.map