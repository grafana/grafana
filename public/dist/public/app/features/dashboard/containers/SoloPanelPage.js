import React, { Component } from 'react';
import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { DashboardPanel } from '../dashgrid/DashboardPanel';
import { initDashboard } from '../state/initDashboard';
const mapStateToProps = (state) => ({
    dashboard: state.dashboard.getModel(),
});
const mapDispatchToProps = {
    initDashboard,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class SoloPanelPage extends Component {
    constructor() {
        super(...arguments);
        this.state = {
            panel: null,
            notFound: false,
        };
    }
    componentDidMount() {
        const { match, route } = this.props;
        this.props.initDashboard({
            urlSlug: match.params.slug,
            urlUid: match.params.uid,
            urlType: match.params.type,
            routeName: route.routeName,
            fixUrl: false,
            keybindingSrv: this.context.keybindings,
        });
    }
    getPanelId() {
        var _a;
        return parseInt((_a = this.props.queryParams.panelId) !== null && _a !== void 0 ? _a : '0', 10);
    }
    componentDidUpdate(prevProps) {
        const { dashboard } = this.props;
        if (!dashboard) {
            return;
        }
        // we just got a new dashboard
        if (!prevProps.dashboard || prevProps.dashboard.uid !== dashboard.uid) {
            const panel = dashboard.getPanelByUrlId(this.props.queryParams.panelId);
            if (!panel) {
                this.setState({ notFound: true });
                return;
            }
            this.setState({ panel });
        }
    }
    render() {
        return (React.createElement(SoloPanel, { dashboard: this.props.dashboard, notFound: this.state.notFound, panel: this.state.panel, panelId: this.getPanelId(), timezone: this.props.queryParams.timezone }));
    }
}
SoloPanelPage.contextType = GrafanaContext;
export const SoloPanel = ({ dashboard, notFound, panel, panelId, timezone }) => {
    if (notFound) {
        return React.createElement("div", { className: "alert alert-error" },
            "Panel with id ",
            panelId,
            " not found");
    }
    if (!panel || !dashboard) {
        return React.createElement("div", null, "Loading & initializing dashboard");
    }
    return (React.createElement("div", { className: "panel-solo" },
        React.createElement(AutoSizer, null, ({ width, height }) => {
            if (width === 0) {
                return null;
            }
            return (React.createElement(DashboardPanel, { stateKey: panel.key, width: width, height: height, dashboard: dashboard, panel: panel, isEditing: false, isViewing: true, lazy: false, timezone: timezone, hideMenu: true }));
        })));
};
export default connector(SoloPanelPage);
//# sourceMappingURL=SoloPanelPage.js.map