import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { LegacyForms, DeleteButton } from '@grafana/ui';
var Select = LegacyForms.Select;
import { teamsPermissionLevels } from 'app/types';
import { WithFeatureToggle } from 'app/core/components/WithFeatureToggle';
import { updateTeamMember, removeTeamMember } from './state/actions';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
var mapDispatchToProps = {
    removeTeamMember: removeTeamMember,
    updateTeamMember: updateTeamMember,
};
var connector = connect(null, mapDispatchToProps);
var TeamMemberRow = /** @class */ (function (_super) {
    __extends(TeamMemberRow, _super);
    function TeamMemberRow(props) {
        var _this = _super.call(this, props) || this;
        _this.onPermissionChange = function (item, member) {
            var permission = item.value;
            var updatedTeamMember = __assign(__assign({}, member), { permission: permission });
            _this.props.updateTeamMember(updatedTeamMember);
        };
        _this.renderLabels = _this.renderLabels.bind(_this);
        _this.renderPermissions = _this.renderPermissions.bind(_this);
        return _this;
    }
    TeamMemberRow.prototype.onRemoveMember = function (member) {
        this.props.removeTeamMember(member.userId);
    };
    TeamMemberRow.prototype.renderPermissions = function (member) {
        var _this = this;
        var _a = this.props, editorsCanAdmin = _a.editorsCanAdmin, signedInUserIsTeamAdmin = _a.signedInUserIsTeamAdmin;
        var value = teamsPermissionLevels.find(function (dp) { return dp.value === member.permission; });
        return (React.createElement(WithFeatureToggle, { featureToggle: editorsCanAdmin },
            React.createElement("td", { className: "width-5 team-permissions" },
                React.createElement("div", { className: "gf-form" },
                    signedInUserIsTeamAdmin && (React.createElement(Select, { menuShouldPortal: true, isSearchable: false, options: teamsPermissionLevels, onChange: function (item) { return _this.onPermissionChange(item, member); }, className: "gf-form-select-box__control--menu-right", value: value })),
                    !signedInUserIsTeamAdmin && React.createElement("span", null, value.label)))));
    };
    TeamMemberRow.prototype.renderLabels = function (labels) {
        if (!labels) {
            return React.createElement("td", null);
        }
        return (React.createElement("td", null, labels.map(function (label) { return (React.createElement(TagBadge, { key: label, label: label, removeIcon: false, count: 0, onClick: function () { } })); })));
    };
    TeamMemberRow.prototype.render = function () {
        var _this = this;
        var _a = this.props, member = _a.member, syncEnabled = _a.syncEnabled, signedInUserIsTeamAdmin = _a.signedInUserIsTeamAdmin;
        return (React.createElement("tr", { key: member.userId },
            React.createElement("td", { className: "width-4 text-center" },
                React.createElement("img", { "aria-label": "Avatar for team member \"" + member.name + "\"", className: "filter-table__avatar", src: member.avatarUrl })),
            React.createElement("td", null, member.login),
            React.createElement("td", null, member.email),
            React.createElement("td", null, member.name),
            this.renderPermissions(member),
            syncEnabled && this.renderLabels(member.labels),
            React.createElement("td", { className: "text-right" },
                React.createElement(DeleteButton, { "aria-label": "Remove team member", size: "sm", disabled: !signedInUserIsTeamAdmin, onConfirm: function () { return _this.onRemoveMember(member); } }))));
    };
    return TeamMemberRow;
}(PureComponent));
export { TeamMemberRow };
export default connector(TeamMemberRow);
//# sourceMappingURL=TeamMemberRow.js.map