import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Subscription } from 'rxjs';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { getAngularLoader } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';
import config from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { setPanelAngularComponent } from 'app/features/panel/state/reducers';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { getTimeSrv } from '../services/TimeSrv';
import { getPanelChromeProps } from '../utils/getPanelChromeProps';
import { PanelHeaderMenuWrapper } from './PanelHeader/PanelHeaderMenuWrapper';
export class PanelChromeAngularUnconnected extends PureComponent {
    constructor(props) {
        super(props);
        this.element = null;
        this.timeSrv = getTimeSrv();
        this.subs = new Subscription();
        this.state = {
            data: {
                state: LoadingState.NotStarted,
                series: [],
                timeRange: getDefaultTimeRange(),
            },
        };
    }
    componentDidMount() {
        const { panel } = this.props;
        this.loadAngularPanel();
        // subscribe to data events
        const queryRunner = panel.getQueryRunner();
        // we are not displaying any of this data so no need for transforms or field config
        this.subs.add(queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
            next: (data) => this.onPanelDataUpdate(data),
        }));
    }
    onPanelDataUpdate(data) {
        let errorMessage;
        if (data.state === LoadingState.Error) {
            const { error } = data;
            if (error) {
                if (errorMessage !== error.message) {
                    errorMessage = error.message;
                }
            }
        }
        this.setState({ data, errorMessage });
    }
    componentWillUnmount() {
        var _a;
        this.subs.unsubscribe();
        if (this.props.angularComponent) {
            (_a = this.props.angularComponent) === null || _a === void 0 ? void 0 : _a.destroy();
        }
    }
    componentDidUpdate(prevProps, prevState) {
        const { plugin, height, width, panel } = this.props;
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
    }
    getInnerPanelHeight() {
        const { plugin, height } = this.props;
        const { theme } = config;
        const headerHeight = this.hasOverlayHeader() ? 0 : theme.panelHeaderHeight;
        const chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
        return height - headerHeight - chromePadding * 2 - PANEL_BORDER;
    }
    getInnerPanelWidth() {
        const { plugin, width } = this.props;
        const { theme } = config;
        const chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
        return width - chromePadding * 2 - PANEL_BORDER;
    }
    loadAngularPanel() {
        const { panel, dashboard, setPanelAngularComponent } = this.props;
        // if we have no element or already have loaded the panel return
        if (!this.element) {
            return;
        }
        const loader = getAngularLoader();
        const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
        this.scopeProps = {
            panel: panel,
            dashboard: dashboard,
            size: { width: this.getInnerPanelWidth(), height: this.getInnerPanelHeight() },
        };
        setPanelAngularComponent({
            key: panel.key,
            angularComponent: loader.load(this.element, this.scopeProps, template),
        });
    }
    hasOverlayHeader() {
        const { panel } = this.props;
        const { data } = this.state;
        // always show normal header if we have time override
        if (data.request && data.request.timeInfo) {
            return false;
        }
        return !panel.hasTitle();
    }
    render() {
        var _a, _b;
        const { dashboard, panel } = this.props;
        const { errorMessage, data } = this.state;
        const { transparent } = panel;
        const panelChromeProps = getPanelChromeProps(Object.assign(Object.assign({}, this.props), { data }));
        // Shift the hover menu down if it's on the top row so it doesn't get clipped by topnav
        const hoverHeaderOffset = ((_b = (_a = panel.gridPos) === null || _a === void 0 ? void 0 : _a.y) !== null && _b !== void 0 ? _b : 0) === 0 ? -16 : undefined;
        const menu = (React.createElement("div", { "data-testid": "panel-dropdown" },
            React.createElement(PanelHeaderMenuWrapper, { panel: panel, dashboard: dashboard, loadingState: data.state })));
        return (React.createElement(PanelChrome, { width: this.props.width, height: this.props.height, title: panelChromeProps.title, loadingState: data.state, statusMessage: errorMessage, statusMessageOnClick: panelChromeProps.onOpenErrorInspect, description: panelChromeProps.description, titleItems: panelChromeProps.titleItems, menu: this.props.hideMenu ? undefined : menu, dragClass: panelChromeProps.dragClass, dragClassCancel: "grid-drag-cancel", padding: panelChromeProps.padding, hoverHeaderOffset: hoverHeaderOffset, hoverHeader: panelChromeProps.hasOverlayHeader(), displayMode: transparent ? 'transparent' : 'default', onCancelQuery: panelChromeProps.onCancelQuery, onOpenMenu: panelChromeProps.onOpenMenu }, () => React.createElement("div", { ref: (element) => (this.element = element), className: "panel-height-helper" })));
    }
}
const mapStateToProps = (state, props) => {
    var _a;
    return {
        angularComponent: (_a = getPanelStateForModel(state, props.panel)) === null || _a === void 0 ? void 0 : _a.angularComponent,
    };
};
const mapDispatchToProps = { setPanelAngularComponent };
export const PanelChromeAngular = connect(mapStateToProps, mapDispatchToProps)(PanelChromeAngularUnconnected);
//# sourceMappingURL=PanelChromeAngular.js.map