import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import _ from 'lodash';
import { hot } from 'react-hot-loader';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import TeamMembers from './TeamMembers';
import TeamSettings from './TeamSettings';
import TeamGroupSync from './TeamGroupSync';
import { loadTeam } from './state/actions';
import { getTeam } from './state/selectors';
import { getTeamLoadingNav } from './state/navModel';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId, getRouteParamsPage } from '../../core/selectors/location';
var PageTypes;
(function (PageTypes) {
    PageTypes["Members"] = "members";
    PageTypes["Settings"] = "settings";
    PageTypes["GroupSync"] = "groupsync";
})(PageTypes || (PageTypes = {}));
var TeamPages = /** @class */ (function (_super) {
    tslib_1.__extends(TeamPages, _super);
    function TeamPages(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {
            isLoading: false,
            isSyncEnabled: config.buildInfo.isEnterprise,
        };
        return _this;
    }
    TeamPages.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchTeam()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TeamPages.prototype.fetchTeam = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, loadTeam, teamId, team;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, loadTeam = _a.loadTeam, teamId = _a.teamId;
                        this.setState({ isLoading: true });
                        return [4 /*yield*/, loadTeam(teamId)];
                    case 1:
                        team = _b.sent();
                        this.setState({ isLoading: false });
                        return [2 /*return*/, team];
                }
            });
        });
    };
    TeamPages.prototype.getCurrentPage = function () {
        var pages = ['members', 'settings', 'groupsync'];
        var currentPage = this.props.pageName;
        return _.includes(pages, currentPage) ? currentPage : pages[0];
    };
    TeamPages.prototype.renderPage = function () {
        var isSyncEnabled = this.state.isSyncEnabled;
        var currentPage = this.getCurrentPage();
        switch (currentPage) {
            case PageTypes.Members:
                return React.createElement(TeamMembers, { syncEnabled: isSyncEnabled });
            case PageTypes.Settings:
                return React.createElement(TeamSettings, null);
            case PageTypes.GroupSync:
                return isSyncEnabled && React.createElement(TeamGroupSync, null);
        }
        return null;
    };
    TeamPages.prototype.render = function () {
        var _a = this.props, team = _a.team, navModel = _a.navModel;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: this.state.isLoading }, team && Object.keys(team).length !== 0 && this.renderPage())));
    };
    return TeamPages;
}(PureComponent));
export { TeamPages };
function mapStateToProps(state) {
    var teamId = getRouteParamsId(state.location);
    var pageName = getRouteParamsPage(state.location) || 'members';
    var teamLoadingNav = getTeamLoadingNav(pageName);
    return {
        navModel: getNavModel(state.navIndex, "team-" + pageName + "-" + teamId, teamLoadingNav),
        teamId: teamId,
        pageName: pageName,
        team: getTeam(state.team, teamId),
    };
}
var mapDispatchToProps = {
    loadTeam: loadTeam,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(TeamPages));
//# sourceMappingURL=TeamPages.js.map