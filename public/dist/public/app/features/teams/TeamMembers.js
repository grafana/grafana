import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { addTeamMember } from './state/actions';
import { getSearchMemberQuery, isSignedInUserTeamAdmin } from './state/selectors';
import { WithFeatureToggle } from 'app/core/components/WithFeatureToggle';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import TeamMemberRow from './TeamMemberRow';
import { setSearchMemberQuery } from './state/reducers';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { Button, FilterInput, Label } from '@grafana/ui';
function mapStateToProps(state) {
    return {
        searchMemberQuery: getSearchMemberQuery(state.team),
        editorsCanAdmin: config.editorsCanAdmin,
        signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
    };
}
var mapDispatchToProps = {
    addTeamMember: addTeamMember,
    setSearchMemberQuery: setSearchMemberQuery,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var TeamMembers = /** @class */ (function (_super) {
    __extends(TeamMembers, _super);
    function TeamMembers(props) {
        var _this = _super.call(this, props) || this;
        _this.onSearchQueryChange = function (value) {
            _this.props.setSearchMemberQuery(value);
        };
        _this.onToggleAdding = function () {
            _this.setState({ isAdding: !_this.state.isAdding });
        };
        _this.onUserSelected = function (user) {
            _this.setState({ newTeamMember: user });
        };
        _this.onAddUserToTeam = function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.props.addTeamMember(this.state.newTeamMember.id);
                this.setState({ newTeamMember: null });
                return [2 /*return*/];
            });
        }); };
        _this.state = { isAdding: false, newTeamMember: null };
        return _this;
    }
    TeamMembers.prototype.renderLabels = function (labels) {
        if (!labels) {
            return React.createElement("td", null);
        }
        return (React.createElement("td", null, labels.map(function (label) { return (React.createElement(TagBadge, { key: label, label: label, removeIcon: false, count: 0, onClick: function () { } })); })));
    };
    TeamMembers.prototype.render = function () {
        var isAdding = this.state.isAdding;
        var _a = this.props, searchMemberQuery = _a.searchMemberQuery, members = _a.members, syncEnabled = _a.syncEnabled, editorsCanAdmin = _a.editorsCanAdmin, signedInUser = _a.signedInUser;
        var isTeamAdmin = isSignedInUserTeamAdmin({ members: members, editorsCanAdmin: editorsCanAdmin, signedInUser: signedInUser });
        return (React.createElement("div", null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement(FilterInput, { placeholder: "Search members", value: searchMemberQuery, onChange: this.onSearchQueryChange })),
                React.createElement(Button, { className: "pull-right", onClick: this.onToggleAdding, disabled: isAdding || !isTeamAdmin }, "Add member")),
            React.createElement(SlideDown, { in: isAdding },
                React.createElement("div", { className: "cta-form" },
                    React.createElement(CloseButton, { "aria-label": "Close 'Add team member' dialogue", onClick: this.onToggleAdding }),
                    React.createElement(Label, { htmlFor: "user-picker" }, "Add team member"),
                    React.createElement("div", { className: "gf-form-inline" },
                        React.createElement(UserPicker, { inputId: "user-picker", onSelected: this.onUserSelected, className: "min-width-30" }),
                        this.state.newTeamMember && (React.createElement(Button, { type: "submit", onClick: this.onAddUserToTeam }, "Add to team"))))),
            React.createElement("div", { className: "admin-list-table" },
                React.createElement("table", { className: "filter-table filter-table--hover form-inline" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null),
                            React.createElement("th", null, "Login"),
                            React.createElement("th", null, "Email"),
                            React.createElement("th", null, "Name"),
                            React.createElement(WithFeatureToggle, { featureToggle: editorsCanAdmin },
                                React.createElement("th", null, "Permission")),
                            syncEnabled && React.createElement("th", null),
                            React.createElement("th", { style: { width: '1%' } }))),
                    React.createElement("tbody", null, members &&
                        members.map(function (member) { return (React.createElement(TeamMemberRow, { key: member.userId, member: member, syncEnabled: syncEnabled, editorsCanAdmin: editorsCanAdmin, signedInUserIsTeamAdmin: isTeamAdmin })); }))))));
    };
    return TeamMembers;
}(PureComponent));
export { TeamMembers };
export default connector(TeamMembers);
//# sourceMappingURL=TeamMembers.js.map