import { __extends } from "tslib";
import React, { Component } from 'react';
import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { DashboardPanel } from '../dashgrid/DashboardPanel';
import { initDashboard } from '../state/initDashboard';
var mapStateToProps = function (state) { return ({
    dashboard: state.dashboard.getModel(),
}); };
var mapDispatchToProps = {
    initDashboard: initDashboard,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var SoloPanelPage = /** @class */ (function (_super) {
    __extends(SoloPanelPage, _super);
    function SoloPanelPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            panel: null,
            notFound: false,
        };
        return _this;
    }
    SoloPanelPage.prototype.componentDidMount = function () {
        var _a = this.props, match = _a.match, route = _a.route;
        this.props.initDashboard({
            urlSlug: match.params.slug,
            urlUid: match.params.uid,
            urlType: match.params.type,
            routeName: route.routeName,
            fixUrl: false,
        });
    };
    SoloPanelPage.prototype.getPanelId = function () {
        var _a;
        return parseInt((_a = this.props.queryParams.panelId) !== null && _a !== void 0 ? _a : '0', 10);
    };
    SoloPanelPage.prototype.componentDidUpdate = function (prevProps) {
        var dashboard = this.props.dashboard;
        if (!dashboard) {
            return;
        }
        // we just got a new dashboard
        if (!prevProps.dashboard || prevProps.dashboard.uid !== dashboard.uid) {
            var panel = dashboard.getPanelByUrlId(this.props.queryParams.panelId);
            if (!panel) {
                this.setState({ notFound: true });
                return;
            }
            this.setState({ panel: panel });
        }
    };
    SoloPanelPage.prototype.render = function () {
        var dashboard = this.props.dashboard;
        var _a = this.state, notFound = _a.notFound, panel = _a.panel;
        if (notFound) {
            return React.createElement("div", { className: "alert alert-error" },
                "Panel with id ",
                this.getPanelId(),
                " not found");
        }
        if (!panel || !dashboard) {
            return React.createElement("div", null, "Loading & initializing dashboard");
        }
        return (React.createElement("div", { className: "panel-solo" },
            React.createElement(AutoSizer, null, function (_a) {
                var width = _a.width, height = _a.height;
                if (width === 0) {
                    return null;
                }
                return (React.createElement(DashboardPanel, { stateKey: panel.key, width: width, height: height, dashboard: dashboard, panel: panel, isEditing: false, isViewing: false, isInView: true }));
            })));
    };
    return SoloPanelPage;
}(Component));
export { SoloPanelPage };
export default connector(SoloPanelPage);
//# sourceMappingURL=SoloPanelPage.js.map