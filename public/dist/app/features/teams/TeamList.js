import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import Page from 'app/core/components/Page/Page';
import { DeleteButton } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { loadTeams, deleteTeam, setSearchQuery } from './state/actions';
import { getSearchQuery, getTeams, getTeamsCount } from './state/selectors';
import { getNavModel } from 'app/core/selectors/navModel';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
var TeamList = /** @class */ (function (_super) {
    tslib_1.__extends(TeamList, _super);
    function TeamList() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.deleteTeam = function (team) {
            _this.props.deleteTeam(team.id);
        };
        _this.onSearchQueryChange = function (value) {
            _this.props.setSearchQuery(value);
        };
        return _this;
    }
    TeamList.prototype.componentDidMount = function () {
        this.fetchTeams();
    };
    TeamList.prototype.fetchTeams = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadTeams()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TeamList.prototype.renderTeam = function (team) {
        var _this = this;
        var teamUrl = "org/teams/edit/" + team.id;
        return (React.createElement("tr", { key: team.id },
            React.createElement("td", { className: "width-4 text-center link-td" },
                React.createElement("a", { href: teamUrl },
                    React.createElement("img", { className: "filter-table__avatar", src: team.avatarUrl }))),
            React.createElement("td", { className: "link-td" },
                React.createElement("a", { href: teamUrl }, team.name)),
            React.createElement("td", { className: "link-td" },
                React.createElement("a", { href: teamUrl }, team.email)),
            React.createElement("td", { className: "link-td" },
                React.createElement("a", { href: teamUrl }, team.memberCount)),
            React.createElement("td", { className: "text-right" },
                React.createElement(DeleteButton, { onConfirm: function () { return _this.deleteTeam(team); } }))));
    };
    TeamList.prototype.renderEmptyList = function () {
        return (React.createElement("div", { className: "page-container page-body" },
            React.createElement(EmptyListCTA, { model: {
                    title: "You haven't created any teams yet.",
                    buttonIcon: 'fa fa-plus',
                    buttonLink: 'org/teams/new',
                    buttonTitle: ' New team',
                    proTip: 'Assign folder and dashboard permissions to teams instead of users to ease administration.',
                    proTipLink: '',
                    proTipLinkTitle: '',
                    proTipTarget: '_blank',
                } })));
    };
    TeamList.prototype.renderTeamList = function () {
        var _this = this;
        var _a = this.props, teams = _a.teams, searchQuery = _a.searchQuery;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement(FilterInput, { labelClassName: "gf-form--has-input-icon gf-form--grow", inputClassName: "gf-form-input", placeholder: "Search teams", value: searchQuery, onChange: this.onSearchQueryChange })),
                React.createElement("div", { className: "page-action-bar__spacer" }),
                React.createElement("a", { className: "btn btn-primary", href: "org/teams/new" }, "New team")),
            React.createElement("div", { className: "admin-list-table" },
                React.createElement("table", { className: "filter-table filter-table--hover form-inline" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null),
                            React.createElement("th", null, "Name"),
                            React.createElement("th", null, "Email"),
                            React.createElement("th", null, "Members"),
                            React.createElement("th", { style: { width: '1%' } }))),
                    React.createElement("tbody", null, teams.map(function (team) { return _this.renderTeam(team); }))))));
    };
    TeamList.prototype.renderList = function () {
        var teamsCount = this.props.teamsCount;
        if (teamsCount > 0) {
            return this.renderTeamList();
        }
        else {
            return this.renderEmptyList();
        }
    };
    TeamList.prototype.render = function () {
        var _a = this.props, hasFetched = _a.hasFetched, navModel = _a.navModel;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: !hasFetched }, hasFetched && this.renderList())));
    };
    return TeamList;
}(PureComponent));
export { TeamList };
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'teams'),
        teams: getTeams(state.teams),
        searchQuery: getSearchQuery(state.teams),
        teamsCount: getTeamsCount(state.teams),
        hasFetched: state.teams.hasFetched,
    };
}
var mapDispatchToProps = {
    loadTeams: loadTeams,
    deleteTeam: deleteTeam,
    setSearchQuery: setSearchQuery,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(TeamList));
//# sourceMappingURL=TeamList.js.map