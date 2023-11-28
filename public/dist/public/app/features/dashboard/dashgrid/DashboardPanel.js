import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { initPanelState } from '../../panel/state/actions';
import { setPanelInstanceState } from '../../panel/state/reducers';
import { LazyLoader } from './LazyLoader';
import { PanelChromeAngular } from './PanelChromeAngular';
import { PanelStateWrapper } from './PanelStateWrapper';
const mapStateToProps = (state, props) => {
    const panelState = state.panels[props.stateKey];
    if (!panelState) {
        return { plugin: null };
    }
    return {
        plugin: panelState.plugin,
        instanceState: panelState.instanceState,
    };
};
const mapDispatchToProps = {
    initPanelState,
    setPanelInstanceState,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class DashboardPanelUnconnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.onInstanceStateChange = (value) => {
            this.props.setPanelInstanceState({ key: this.props.stateKey, value });
        };
        this.onVisibilityChange = (v) => {
            this.props.panel.isInView = v;
        };
        this.onPanelLoad = () => {
            if (!this.props.plugin) {
                this.props.initPanelState(this.props.panel);
            }
        };
        this.renderPanel = ({ isInView }) => {
            const { dashboard, panel, isViewing, isEditing, width, height, plugin, timezone, hideMenu, isDraggable = true, } = this.props;
            if (!plugin) {
                return null;
            }
            if (plugin && plugin.angularPanelCtrl) {
                return (React.createElement(PanelChromeAngular, { plugin: plugin, panel: panel, dashboard: dashboard, isViewing: isViewing, isEditing: isEditing, isInView: isInView, isDraggable: isDraggable, width: width, height: height }));
            }
            return (React.createElement(PanelStateWrapper, { plugin: plugin, panel: panel, dashboard: dashboard, isViewing: isViewing, isEditing: isEditing, isInView: isInView, isDraggable: isDraggable, width: width, height: height, onInstanceStateChange: this.onInstanceStateChange, timezone: timezone, hideMenu: hideMenu }));
        };
    }
    componentDidMount() {
        this.props.panel.isInView = !this.props.lazy;
        if (!this.props.lazy) {
            this.onPanelLoad();
        }
    }
    render() {
        const { width, height, lazy } = this.props;
        return lazy ? (React.createElement(LazyLoader, { width: width, height: height, onChange: this.onVisibilityChange, onLoad: this.onPanelLoad }, this.renderPanel)) : (this.renderPanel({ isInView: true }));
    }
}
DashboardPanelUnconnected.defaultProps = {
    lazy: true,
};
export const DashboardPanel = connector(DashboardPanelUnconnected);
//# sourceMappingURL=DashboardPanel.js.map