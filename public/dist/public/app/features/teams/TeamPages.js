import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { includes } from 'lodash';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import TeamMembers from './TeamMembers';
import TeamSettings from './TeamSettings';
import TeamGroupSync from './TeamGroupSync';
import { loadTeam, loadTeamMembers } from './state/actions';
import { getTeam, getTeamMembers, isSignedInUserTeamAdmin } from './state/selectors';
import { getTeamLoadingNav } from './state/navModel';
import { getNavModel } from 'app/core/selectors/navModel';
import { contextSrv } from 'app/core/services/context_srv';
var PageTypes;
(function (PageTypes) {
    PageTypes["Members"] = "members";
    PageTypes["Settings"] = "settings";
    PageTypes["GroupSync"] = "groupsync";
})(PageTypes || (PageTypes = {}));
function mapStateToProps(state, props) {
    var _a;
    var teamId = parseInt(props.match.params.id, 10);
    var pageName = (_a = props.match.params.page) !== null && _a !== void 0 ? _a : 'members';
    var teamLoadingNav = getTeamLoadingNav(pageName);
    var navModel = getNavModel(state.navIndex, "team-" + pageName + "-" + teamId, teamLoadingNav);
    var team = getTeam(state.team, teamId);
    var members = getTeamMembers(state.team);
    return {
        navModel: navModel,
        teamId: teamId,
        pageName: pageName,
        team: team,
        members: members,
        editorsCanAdmin: config.editorsCanAdmin,
        signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
    };
}
var mapDispatchToProps = {
    loadTeam: loadTeam,
    loadTeamMembers: loadTeamMembers,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var TeamPages = /** @class */ (function (_super) {
    __extends(TeamPages, _super);
    function TeamPages(props) {
        var _this = _super.call(this, props) || this;
        _this.textsAreEqual = function (text1, text2) {
            if (!text1 && !text2) {
                return true;
            }
            if (!text1 || !text2) {
                return false;
            }
            return text1.toLocaleLowerCase() === text2.toLocaleLowerCase();
        };
        _this.hideTabsFromNonTeamAdmin = function (navModel, isSignedInUserTeamAdmin) {
            if (!isSignedInUserTeamAdmin && navModel.main && navModel.main.children) {
                navModel.main.children
                    .filter(function (navItem) { return !_this.textsAreEqual(navItem.text, PageTypes.Members); })
                    .map(function (navItem) {
                    navItem.hideFromTabs = true;
                });
            }
            return navModel;
        };
        _this.state = {
            isLoading: false,
            isSyncEnabled: config.licenseInfo.hasLicense,
        };
        return _this;
    }
    TeamPages.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
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
        return __awaiter(this, void 0, void 0, function () {
            var _a, loadTeam, teamId, team;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, loadTeam = _a.loadTeam, teamId = _a.teamId;
                        this.setState({ isLoading: true });
                        return [4 /*yield*/, loadTeam(teamId)];
                    case 1:
                        team = _b.sent();
                        return [4 /*yield*/, this.props.loadTeamMembers()];
                    case 2:
                        _b.sent();
                        this.setState({ isLoading: false });
                        return [2 /*return*/, team];
                }
            });
        });
    };
    TeamPages.prototype.getCurrentPage = function () {
        var pages = ['members', 'settings', 'groupsync'];
        var currentPage = this.props.pageName;
        return includes(pages, currentPage) ? currentPage : pages[0];
    };
    TeamPages.prototype.renderPage = function (isSignedInUserTeamAdmin) {
        var isSyncEnabled = this.state.isSyncEnabled;
        var _a = this.props, members = _a.members, team = _a.team;
        var currentPage = this.getCurrentPage();
        switch (currentPage) {
            case PageTypes.Members:
                return React.createElement(TeamMembers, { syncEnabled: isSyncEnabled, members: members });
            case PageTypes.Settings:
                return isSignedInUserTeamAdmin && React.createElement(TeamSettings, { team: team });
            case PageTypes.GroupSync:
                return isSignedInUserTeamAdmin && isSyncEnabled && React.createElement(TeamGroupSync, null);
        }
        return null;
    };
    TeamPages.prototype.render = function () {
        var _a = this.props, team = _a.team, navModel = _a.navModel, members = _a.members, editorsCanAdmin = _a.editorsCanAdmin, signedInUser = _a.signedInUser;
        var isTeamAdmin = isSignedInUserTeamAdmin({ members: members, editorsCanAdmin: editorsCanAdmin, signedInUser: signedInUser });
        return (React.createElement(Page, { navModel: this.hideTabsFromNonTeamAdmin(navModel, isTeamAdmin) },
            React.createElement(Page.Contents, { isLoading: this.state.isLoading }, team && Object.keys(team).length !== 0 && this.renderPage(isTeamAdmin))));
    };
    return TeamPages;
}(PureComponent));
export { TeamPages };
export default connector(TeamPages);
//# sourceMappingURL=TeamPages.js.map