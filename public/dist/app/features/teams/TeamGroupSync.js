import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import SlideDown from 'app/core/components/Animations/SlideDown';
import { Tooltip } from '@grafana/ui';
import { addTeamGroup, loadTeamGroups, removeTeamGroup } from './state/actions';
import { getTeamGroups } from './state/selectors';
var headerTooltip = "Sync LDAP or OAuth groups with your Grafana teams.";
var TeamGroupSync = /** @class */ (function (_super) {
    tslib_1.__extends(TeamGroupSync, _super);
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
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
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
                React.createElement("a", { className: "btn btn-danger btn-mini", onClick: function () { return _this.onRemoveGroup(group); } },
                    React.createElement("i", { className: "fa fa-remove" })))));
    };
    TeamGroupSync.prototype.render = function () {
        var _this = this;
        var _a = this.state, isAdding = _a.isAdding, newGroupId = _a.newGroupId;
        var groups = this.props.groups;
        return (React.createElement("div", null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement("h3", { className: "page-sub-heading" }, "External group sync"),
                React.createElement(Tooltip, { placement: "auto", content: headerTooltip },
                    React.createElement("div", { className: "page-sub-heading-icon" },
                        React.createElement("i", { className: "gicon gicon-question gicon--has-hover" }))),
                React.createElement("div", { className: "page-action-bar__spacer" }),
                groups.length > 0 && (React.createElement("button", { className: "btn btn-primary pull-right", onClick: this.onToggleAdding },
                    React.createElement("i", { className: "fa fa-plus" }),
                    " Add group"))),
            React.createElement(SlideDown, { in: isAdding },
                React.createElement("div", { className: "cta-form" },
                    React.createElement("button", { className: "cta-form__close btn btn-transparent", onClick: this.onToggleAdding },
                        React.createElement("i", { className: "fa fa-close" })),
                    React.createElement("h5", null, "Add External Group"),
                    React.createElement("form", { className: "gf-form-inline", onSubmit: this.onAddGroup },
                        React.createElement("div", { className: "gf-form" },
                            React.createElement("input", { type: "text", className: "gf-form-input width-30", value: newGroupId, onChange: this.onNewGroupIdChanged, placeholder: "cn=ops,ou=groups,dc=grafana,dc=org" })),
                        React.createElement("div", { className: "gf-form" },
                            React.createElement("button", { className: "btn btn-primary gf-form-btn", type: "submit", disabled: !this.isNewGroupValid() }, "Add group"))))),
            groups.length === 0 && !isAdding && (React.createElement("div", { className: "empty-list-cta" },
                React.createElement("div", { className: "empty-list-cta__title" }, "There are no external groups to sync with"),
                React.createElement("button", { onClick: this.onToggleAdding, className: "empty-list-cta__button btn btn-xlarge btn-primary" },
                    React.createElement("i", { className: "gicon gicon-add-team" }),
                    "Add Group"),
                React.createElement("div", { className: "empty-list-cta__pro-tip" },
                    React.createElement("i", { className: "fa fa-rocket" }),
                    " ",
                    headerTooltip,
                    React.createElement("a", { className: "text-link empty-list-cta__pro-tip-link", href: "http://docs.grafana.org/auth/enhanced_ldap/", target: "_blank" }, "Learn more")))),
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
export default connect(mapStateToProps, mapDispatchToProps)(TeamGroupSync);
//# sourceMappingURL=TeamGroupSync.js.map