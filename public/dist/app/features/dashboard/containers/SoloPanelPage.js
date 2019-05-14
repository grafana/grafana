import * as tslib_1 from "tslib";
// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
// Components
import { DashboardPanel } from '../dashgrid/DashboardPanel';
// Redux
import { initDashboard } from '../state/initDashboard';
var SoloPanelPage = /** @class */ (function (_super) {
    tslib_1.__extends(SoloPanelPage, _super);
    function SoloPanelPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            panel: null,
            notFound: false,
        };
        return _this;
    }
    SoloPanelPage.prototype.componentDidMount = function () {
        var _a = this.props, $injector = _a.$injector, $scope = _a.$scope, urlUid = _a.urlUid, urlType = _a.urlType, urlSlug = _a.urlSlug, routeInfo = _a.routeInfo;
        this.props.initDashboard({
            $injector: $injector,
            $scope: $scope,
            urlSlug: urlSlug,
            urlUid: urlUid,
            urlType: urlType,
            routeInfo: routeInfo,
            fixUrl: false,
        });
    };
    SoloPanelPage.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.props, urlPanelId = _a.urlPanelId, dashboard = _a.dashboard;
        if (!dashboard) {
            return;
        }
        // we just got the dashboard!
        if (!prevProps.dashboard) {
            var panelId = parseInt(urlPanelId, 10);
            // need to expand parent row if this panel is inside a row
            dashboard.expandParentRowFor(panelId);
            var panel = dashboard.getPanelById(panelId);
            if (!panel) {
                this.setState({ notFound: true });
                return;
            }
            this.setState({ panel: panel });
        }
    };
    SoloPanelPage.prototype.render = function () {
        var _a = this.props, urlPanelId = _a.urlPanelId, dashboard = _a.dashboard;
        var _b = this.state, notFound = _b.notFound, panel = _b.panel;
        if (notFound) {
            return React.createElement("div", { className: "alert alert-error" },
                "Panel with id ",
                urlPanelId,
                " not found");
        }
        if (!panel) {
            return React.createElement("div", null, "Loading & initializing dashboard");
        }
        return (React.createElement("div", { className: "panel-solo" },
            React.createElement(DashboardPanel, { dashboard: dashboard, panel: panel, isEditing: false, isFullscreen: false })));
    };
    return SoloPanelPage;
}(Component));
export { SoloPanelPage };
var mapStateToProps = function (state) { return ({
    urlUid: state.location.routeParams.uid,
    urlSlug: state.location.routeParams.slug,
    urlType: state.location.routeParams.type,
    urlPanelId: state.location.query.panelId,
    dashboard: state.dashboard.model,
}); };
var mapDispatchToProps = {
    initDashboard: initDashboard,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(SoloPanelPage));
//# sourceMappingURL=SoloPanelPage.js.map