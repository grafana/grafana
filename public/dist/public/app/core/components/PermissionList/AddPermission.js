import { __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
import React, { Component } from 'react';
import { css } from '@emotion/css';
import config from 'app/core/config';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { TeamPicker } from 'app/core/components/Select/TeamPicker';
import { Button, Form, HorizontalGroup, Select, stylesFactory } from '@grafana/ui';
import { dashboardPermissionLevels, dashboardAclTargets, AclTarget, PermissionLevel, OrgRole, } from 'app/types/acl';
import { CloseButton } from '../CloseButton/CloseButton';
var AddPermissions = /** @class */ (function (_super) {
    __extends(AddPermissions, _super);
    function AddPermissions(props) {
        var _this = _super.call(this, props) || this;
        _this.onTypeChanged = function (item) {
            var type = item.value;
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
            var _a;
            _this.setState({ teamId: ((_a = team.value) === null || _a === void 0 ? void 0 : _a.id) && !Array.isArray(team.value) ? team.value.id : 0 });
        };
        _this.onPermissionChanged = function (permission) {
            _this.setState({ permission: permission.value });
        };
        _this.onSubmit = function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.onAddPermission(this.state)];
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
            role: undefined,
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
        var _this = this;
        var onCancel = this.props.onCancel;
        var newItem = this.state;
        var pickerClassName = 'min-width-20';
        var isValid = this.isValid();
        var styles = getStyles(config.theme);
        return (React.createElement("div", { className: "cta-form" },
            React.createElement(CloseButton, { onClick: onCancel }),
            React.createElement("h5", null, "Add Permission For"),
            React.createElement(Form, { maxWidth: "none", onSubmit: this.onSubmit }, function () { return (React.createElement(HorizontalGroup, null,
                React.createElement(Select, { "aria-label": "Role to add new permission to", isSearchable: false, value: _this.state.type, options: dashboardAclTargets, onChange: _this.onTypeChanged, menuShouldPortal: true }),
                newItem.type === AclTarget.User ? (React.createElement(UserPicker, { onSelected: _this.onUserSelected, className: pickerClassName })) : null,
                newItem.type === AclTarget.Team ? (React.createElement(TeamPicker, { onSelected: _this.onTeamSelected, className: pickerClassName })) : null,
                React.createElement("span", { className: styles.label }, "Can"),
                React.createElement(Select, { "aria-label": "Permission level", isSearchable: false, value: _this.state.permission, options: dashboardPermissionLevels, onChange: _this.onPermissionChanged, width: 25, menuShouldPortal: true }),
                React.createElement(Button, { "data-save-permission": true, type: "submit", disabled: !isValid }, "Save"))); })));
    };
    AddPermissions.defaultProps = {
        showPermissionLevels: true,
    };
    return AddPermissions;
}(Component));
var getStyles = stylesFactory(function (theme) { return ({
    label: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n    font-weight: bold;\n  "], ["\n    color: ", ";\n    font-weight: bold;\n  "])), theme.colors.textBlue),
}); });
export default AddPermissions;
var templateObject_1;
//# sourceMappingURL=AddPermission.js.map