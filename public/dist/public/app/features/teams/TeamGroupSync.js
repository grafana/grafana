import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { LegacyForms, Tooltip, Icon, Button } from '@grafana/ui';
var Input = LegacyForms.Input;
import { addTeamGroup, loadTeamGroups, removeTeamGroup } from './state/actions';
import { getTeamGroups } from './state/selectors';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
function mapStateToProps(state) {
    return {
        groups: getTeamGroups(state.team),
    };
}
var mapDispatchToProps = {
    loadTeamGroups: loadTeamGroups,
    addTeamGroup: addTeamGroup,
    removeTeamGroup: removeTeamGroup,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var headerTooltip = "Sync LDAP or OAuth groups with your Grafana teams.";
var TeamGroupSync = /** @class */ (function (_super) {
    __extends(TeamGroupSync, _super);
    function TeamGroupSync(props) {
        var _this = _super.call(this, props) || this;
        _this.onToggleAdding = function () {
            _this.setState({ isAdding: !_this.state.isAdding });
        };
        _this.onNewGroupIdChanged = function (event) {
            _this.setState({ newGroupId: event.target.value });
        };
        _this.onAddGroup = function (event) {
            event.preventDefault();
            _this.props.addTeamGroup(_this.state.newGroupId);
            _this.setState({ isAdding: false, newGroupId: '' });
        };
        _this.onRemoveGroup = function (group) {
            _this.props.removeTeamGroup(group.groupId);
        };
        _this.state = { isAdding: false, newGroupId: '' };
        return _this;
    }
    TeamGroupSync.prototype.componentDidMount = function () {
        this.fetchTeamGroups();
    };
    TeamGroupSync.prototype.fetchTeamGroups = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadTeamGroups()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TeamGroupSync.prototype.isNewGroupValid = function () {
        return this.state.newGroupId.length > 1;
    };
    TeamGroupSync.prototype.renderGroup = function (group) {
        var _this = this;
        return (React.createElement("tr", { key: group.groupId },
            React.createElement("td", null, group.groupId),
            React.createElement("td", { style: { width: '1%' } },
                React.createElement(Button, { size: "sm", variant: "destructive", onClick: function () { return _this.onRemoveGroup(group); } },
                    React.createElement(Icon, { name: "times" })))));
    };
    TeamGroupSync.prototype.render = function () {
        var _this = this;
        var _a = this.state, isAdding = _a.isAdding, newGroupId = _a.newGroupId;
        var groups = this.props.groups;
        return (React.createElement("div", null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement("h3", { className: "page-sub-heading" }, "External group sync"),
                React.createElement(Tooltip, { placement: "auto", content: headerTooltip },
                    React.createElement(Icon, { className: "icon--has-hover page-sub-heading-icon", name: "question-circle" })),
                React.createElement("div", { className: "page-action-bar__spacer" }),
                groups.length > 0 && (React.createElement(Button, { className: "pull-right", onClick: this.onToggleAdding },
                    React.createElement(Icon, { name: "plus" }),
                    " Add group"))),
            React.createElement(SlideDown, { in: isAdding },
                React.createElement("div", { className: "cta-form" },
                    React.createElement(CloseButton, { onClick: this.onToggleAdding }),
                    React.createElement("h5", null, "Add External Group"),
                    React.createElement("form", { className: "gf-form-inline", onSubmit: this.onAddGroup },
                        React.createElement("div", { className: "gf-form" },
                            React.createElement(Input, { type: "text", className: "gf-form-input width-30", value: newGroupId, onChange: this.onNewGroupIdChanged, placeholder: "cn=ops,ou=groups,dc=grafana,dc=org" })),
                        React.createElement("div", { className: "gf-form" },
                            React.createElement(Button, { type: "submit", disabled: !this.isNewGroupValid() }, "Add group"))))),
            groups.length === 0 && !isAdding && (React.createElement(EmptyListCTA, { onClick: this.onToggleAdding, buttonIcon: "users-alt", title: "There are no external groups to sync with", buttonTitle: "Add Group", proTip: headerTooltip, proTipLinkTitle: "Learn more", proTipLink: "http://docs.grafana.org/auth/enhanced_ldap/", proTipTarget: "_blank" })),
            groups.length > 0 && (React.createElement("div", { className: "admin-list-table" },
                React.createElement("table", { className: "filter-table filter-table--hover form-inline" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "External Group ID"),
                            React.createElement("th", { style: { width: '1%' } }))),
                    React.createElement("tbody", null, groups.map(function (group) { return _this.renderGroup(group); })))))));
    };
    return TeamGroupSync;
}(PureComponent));
export { TeamGroupSync };
export default connect(mapStateToProps, mapDispatchToProps)(TeamGroupSync);
//# sourceMappingURL=TeamGroupSync.js.map