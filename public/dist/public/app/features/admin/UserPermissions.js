import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { ConfirmButton, RadioButtonGroup, Icon } from '@grafana/ui';
import { cx } from '@emotion/css';
import { AccessControlAction } from 'app/types';
import { contextSrv } from 'app/core/core';
var adminOptions = [
    { label: 'Yes', value: 'YES' },
    { label: 'No', value: 'NO' },
];
var UserPermissions = /** @class */ (function (_super) {
    __extends(UserPermissions, _super);
    function UserPermissions() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isEditing: false,
            currentAdminOption: _this.props.isGrafanaAdmin ? 'YES' : 'NO',
        };
        _this.onChangeClick = function () {
            _this.setState({ isEditing: true });
        };
        _this.onCancelClick = function () {
            _this.setState({
                isEditing: false,
                currentAdminOption: _this.props.isGrafanaAdmin ? 'YES' : 'NO',
            });
        };
        _this.onGrafanaAdminChange = function () {
            var currentAdminOption = _this.state.currentAdminOption;
            var newIsGrafanaAdmin = currentAdminOption === 'YES' ? true : false;
            _this.props.onGrafanaAdminChange(newIsGrafanaAdmin);
        };
        _this.onAdminOptionSelect = function (value) {
            _this.setState({ currentAdminOption: value });
        };
        return _this;
    }
    UserPermissions.prototype.render = function () {
        var isGrafanaAdmin = this.props.isGrafanaAdmin;
        var _a = this.state, isEditing = _a.isEditing, currentAdminOption = _a.currentAdminOption;
        var changeButtonContainerClass = cx('pull-right');
        var canChangePermissions = contextSrv.hasPermission(AccessControlAction.UsersPermissionsUpdate);
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" }, "Permissions"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("table", { className: "filter-table form-inline" },
                        React.createElement("tbody", null,
                            React.createElement("tr", null,
                                React.createElement("td", { className: "width-16" }, "Grafana Admin"),
                                isEditing ? (React.createElement("td", { colSpan: 2 },
                                    React.createElement(RadioButtonGroup, { options: adminOptions, value: currentAdminOption, onChange: this.onAdminOptionSelect }))) : (React.createElement("td", { colSpan: 2 }, isGrafanaAdmin ? (React.createElement(React.Fragment, null,
                                    React.createElement(Icon, { name: "shield" }),
                                    " Yes")) : (React.createElement(React.Fragment, null, "No")))),
                                React.createElement("td", null,
                                    React.createElement("div", { className: changeButtonContainerClass }, canChangePermissions && (React.createElement(ConfirmButton, { className: "pull-right", onClick: this.onChangeClick, onConfirm: this.onGrafanaAdminChange, onCancel: this.onCancelClick, confirmText: "Change" }, "Change")))))))))));
    };
    return UserPermissions;
}(PureComponent));
export { UserPermissions };
//# sourceMappingURL=UserPermissions.js.map