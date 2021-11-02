import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css, cx } from '@emotion/css';
import { Button, ConfirmButton, Field, HorizontalGroup, Icon, Modal, stylesFactory, Tooltip, useStyles2, withTheme, } from '@grafana/ui';
import { AccessControlAction, OrgRole } from 'app/types';
import { OrgPicker } from 'app/core/components/Select/OrgPicker';
import { OrgRolePicker } from './OrgRolePicker';
import { contextSrv } from 'app/core/core';
var UserOrgs = /** @class */ (function (_super) {
    __extends(UserOrgs, _super);
    function UserOrgs() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            showAddOrgModal: false,
        };
        _this.showOrgAddModal = function (show) { return function () {
            _this.setState({ showAddOrgModal: show });
        }; };
        return _this;
    }
    UserOrgs.prototype.render = function () {
        var _a = this.props, orgs = _a.orgs, isExternalUser = _a.isExternalUser, onOrgRoleChange = _a.onOrgRoleChange, onOrgRemove = _a.onOrgRemove, onOrgAdd = _a.onOrgAdd;
        var showAddOrgModal = this.state.showAddOrgModal;
        var addToOrgContainerClass = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: 0.8rem;\n    "], ["\n      margin-top: 0.8rem;\n    "])));
        var canAddToOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" }, "Organizations"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("table", { className: "filter-table form-inline" },
                        React.createElement("tbody", null, orgs.map(function (org, index) { return (React.createElement(OrgRow, { key: org.orgId + "-" + index, isExternalUser: isExternalUser, org: org, onOrgRoleChange: onOrgRoleChange, onOrgRemove: onOrgRemove })); })))),
                React.createElement("div", { className: addToOrgContainerClass }, canAddToOrg && (React.createElement(Button, { variant: "secondary", onClick: this.showOrgAddModal(true) }, "Add user to organization"))),
                React.createElement(AddToOrgModal, { isOpen: showAddOrgModal, onOrgAdd: onOrgAdd, onDismiss: this.showOrgAddModal(false) }))));
    };
    return UserOrgs;
}(PureComponent));
export { UserOrgs };
var getOrgRowStyles = stylesFactory(function (theme) {
    return {
        removeButton: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-right: 0.6rem;\n      text-decoration: underline;\n      color: ", ";\n    "], ["\n      margin-right: 0.6rem;\n      text-decoration: underline;\n      color: ", ";\n    "])), theme.palette.blue95),
        label: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      font-weight: 500;\n    "], ["\n      font-weight: 500;\n    "]))),
        disabledTooltip: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        tooltipItem: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-left: 5px;\n    "], ["\n      margin-left: 5px;\n    "]))),
        tooltipItemLink: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.palette.blue95),
    };
});
var UnThemedOrgRow = /** @class */ (function (_super) {
    __extends(UnThemedOrgRow, _super);
    function UnThemedOrgRow() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            currentRole: _this.props.org.role,
            isChangingRole: false,
        };
        _this.onOrgRemove = function () {
            var org = _this.props.org;
            _this.props.onOrgRemove(org.orgId);
        };
        _this.onChangeRoleClick = function () {
            var org = _this.props.org;
            _this.setState({ isChangingRole: true, currentRole: org.role });
        };
        _this.onOrgRoleChange = function (newRole) {
            _this.setState({ currentRole: newRole });
        };
        _this.onOrgRoleSave = function () {
            _this.props.onOrgRoleChange(_this.props.org.orgId, _this.state.currentRole);
        };
        _this.onCancelClick = function () {
            _this.setState({ isChangingRole: false });
        };
        return _this;
    }
    UnThemedOrgRow.prototype.render = function () {
        var _a = this.props, org = _a.org, isExternalUser = _a.isExternalUser, theme = _a.theme;
        var _b = this.state, currentRole = _b.currentRole, isChangingRole = _b.isChangingRole;
        var styles = getOrgRowStyles(theme);
        var labelClass = cx('width-16', styles.label);
        var canChangeRole = contextSrv.hasPermission(AccessControlAction.OrgUsersRoleUpdate);
        var canRemoveFromOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersRemove);
        return (React.createElement("tr", null,
            React.createElement("td", { className: labelClass }, org.name),
            isChangingRole ? (React.createElement("td", null,
                React.createElement(OrgRolePicker, { value: currentRole, onChange: this.onOrgRoleChange }))) : (React.createElement("td", { className: "width-25" }, org.role)),
            React.createElement("td", { colSpan: 1 },
                React.createElement("div", { className: "pull-right" }, canChangeRole && (React.createElement(ChangeOrgButton, { isExternalUser: isExternalUser, onChangeRoleClick: this.onChangeRoleClick, onCancelClick: this.onCancelClick, onOrgRoleSave: this.onOrgRoleSave })))),
            React.createElement("td", { colSpan: 1 },
                React.createElement("div", { className: "pull-right" }, canRemoveFromOrg && (React.createElement(ConfirmButton, { confirmText: "Confirm removal", confirmVariant: "destructive", onCancel: this.onCancelClick, onConfirm: this.onOrgRemove }, "Remove from organization"))))));
    };
    return UnThemedOrgRow;
}(PureComponent));
var OrgRow = withTheme(UnThemedOrgRow);
var getAddToOrgModalStyles = stylesFactory(function () { return ({
    modal: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    width: 500px;\n  "], ["\n    width: 500px;\n  "]))),
    buttonRow: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    text-align: center;\n  "], ["\n    text-align: center;\n  "]))),
    modalContent: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    overflow: visible;\n  "], ["\n    overflow: visible;\n  "]))),
}); });
var AddToOrgModal = /** @class */ (function (_super) {
    __extends(AddToOrgModal, _super);
    function AddToOrgModal() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            selectedOrg: null,
            role: OrgRole.Admin,
        };
        _this.onOrgSelect = function (org) {
            _this.setState({ selectedOrg: org.value });
        };
        _this.onOrgRoleChange = function (newRole) {
            _this.setState({
                role: newRole,
            });
        };
        _this.onAddUserToOrg = function () {
            var _a = _this.state, selectedOrg = _a.selectedOrg, role = _a.role;
            _this.props.onOrgAdd(selectedOrg.id, role);
        };
        _this.onCancel = function () {
            if (_this.props.onDismiss) {
                _this.props.onDismiss();
            }
        };
        return _this;
    }
    AddToOrgModal.prototype.render = function () {
        var isOpen = this.props.isOpen;
        var role = this.state.role;
        var styles = getAddToOrgModalStyles();
        return (React.createElement(Modal, { className: styles.modal, contentClassName: styles.modalContent, title: "Add to an organization", isOpen: isOpen, onDismiss: this.onCancel },
            React.createElement(Field, { label: "Organization" },
                React.createElement(OrgPicker, { onSelected: this.onOrgSelect })),
            React.createElement(Field, { label: "Role" },
                React.createElement(OrgRolePicker, { value: role, onChange: this.onOrgRoleChange })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(HorizontalGroup, { spacing: "md", justify: "center" },
                    React.createElement(Button, { variant: "secondary", fill: "outline", onClick: this.onCancel }, "Cancel"),
                    React.createElement(Button, { variant: "primary", onClick: this.onAddUserToOrg }, "Add to organization")))));
    };
    return AddToOrgModal;
}(PureComponent));
export { AddToOrgModal };
var getChangeOrgButtonTheme = function (theme) { return ({
    disabledTooltip: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n    display: flex;\n  "], ["\n    display: flex;\n  "]))),
    tooltipItemLink: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.v1.palette.blue95),
}); };
export function ChangeOrgButton(_a) {
    var onChangeRoleClick = _a.onChangeRoleClick, isExternalUser = _a.isExternalUser, onOrgRoleSave = _a.onOrgRoleSave, onCancelClick = _a.onCancelClick;
    var styles = useStyles2(getChangeOrgButtonTheme);
    return (React.createElement("div", { className: styles.disabledTooltip },
        React.createElement(ConfirmButton, { confirmText: "Save", onClick: onChangeRoleClick, onCancel: onCancelClick, onConfirm: onOrgRoleSave, disabled: isExternalUser }, "Change role"),
        isExternalUser && (React.createElement(Tooltip, { placement: "right-end", content: React.createElement("div", null,
                "This user's role is not editable because it is synchronized from your auth provider. Refer to the\u00A0",
                React.createElement("a", { className: styles.tooltipItemLink, href: 'https://grafana.com/docs/grafana/latest/auth', rel: "noreferrer", target: "_blank" }, "Grafana authentication docs"),
                "\u00A0for details.") },
            React.createElement(Icon, { name: "question-circle" })))));
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11;
//# sourceMappingURL=UserOrgs.js.map