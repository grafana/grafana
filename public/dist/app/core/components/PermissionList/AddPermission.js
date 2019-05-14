import * as tslib_1 from "tslib";
import React, { Component } from 'react';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { TeamPicker } from 'app/core/components/Select/TeamPicker';
import { Select } from '@grafana/ui';
import { dashboardPermissionLevels, dashboardAclTargets, AclTarget, PermissionLevel, OrgRole, } from 'app/types/acl';
var AddPermissions = /** @class */ (function (_super) {
    tslib_1.__extends(AddPermissions, _super);
    function AddPermissions(props) {
        var _this = _super.call(this, props) || this;
        _this.onTypeChanged = function (evt) {
            var type = evt.target.value;
            switch (type) {
                case AclTarget.User:
                case AclTarget.Team:
                    _this.setState({ type: type, userId: 0, teamId: 0, role: undefined });
                    break;
                case AclTarget.Editor:
                    _this.setState({ type: type, userId: 0, teamId: 0, role: OrgRole.Editor });
                    break;
                case AclTarget.Viewer:
                    _this.setState({ type: type, userId: 0, teamId: 0, role: OrgRole.Viewer });
                    break;
            }
        };
        _this.onUserSelected = function (user) {
            _this.setState({ userId: user && !Array.isArray(user) ? user.id : 0 });
        };
        _this.onTeamSelected = function (team) {
            _this.setState({ teamId: team && !Array.isArray(team) ? team.id : 0 });
        };
        _this.onPermissionChanged = function (permission) {
            _this.setState({ permission: permission.value });
        };
        _this.onSubmit = function (evt) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        evt.preventDefault();
                        return [4 /*yield*/, this.props.onAddPermission(this.state)];
                    case 1:
                        _a.sent();
                        this.setState(this.getCleanState());
                        return [2 /*return*/];
                }
            });
        }); };
        _this.state = _this.getCleanState();
        return _this;
    }
    AddPermissions.prototype.getCleanState = function () {
        return {
            userId: 0,
            teamId: 0,
            type: AclTarget.Team,
            permission: PermissionLevel.View,
        };
    };
    AddPermissions.prototype.isValid = function () {
        switch (this.state.type) {
            case AclTarget.Team:
                return this.state.teamId > 0;
            case AclTarget.User:
                return this.state.userId > 0;
        }
        return true;
    };
    AddPermissions.prototype.render = function () {
        var onCancel = this.props.onCancel;
        var newItem = this.state;
        var pickerClassName = 'min-width-20';
        var isValid = this.isValid();
        return (React.createElement("div", { className: "gf-form-inline cta-form" },
            React.createElement("button", { className: "cta-form__close btn btn-transparent", onClick: onCancel },
                React.createElement("i", { className: "fa fa-close" })),
            React.createElement("form", { name: "addPermission", onSubmit: this.onSubmit },
                React.createElement("h5", null, "Add Permission For"),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement("div", { className: "gf-form-select-wrapper" },
                            React.createElement("select", { className: "gf-form-input gf-size-auto", value: newItem.type, onChange: this.onTypeChanged }, dashboardAclTargets.map(function (option, idx) {
                                return (React.createElement("option", { key: idx, value: option.value }, option.text));
                            })))),
                    newItem.type === AclTarget.User ? (React.createElement("div", { className: "gf-form" },
                        React.createElement(UserPicker, { onSelected: this.onUserSelected, className: pickerClassName }))) : null,
                    newItem.type === AclTarget.Team ? (React.createElement("div", { className: "gf-form" },
                        React.createElement(TeamPicker, { onSelected: this.onTeamSelected, className: pickerClassName }))) : null,
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(Select, { isSearchable: false, options: dashboardPermissionLevels, onChange: this.onPermissionChanged, className: "gf-form-select-box__control--menu-right" })),
                    React.createElement("div", { className: "gf-form" },
                        React.createElement("button", { "data-save-permission": true, className: "btn btn-primary", type: "submit", disabled: !isValid }, "Save"))))));
    };
    AddPermissions.defaultProps = {
        showPermissionLevels: true,
    };
    return AddPermissions;
}(Component));
export default AddPermissions;
//# sourceMappingURL=AddPermission.js.map