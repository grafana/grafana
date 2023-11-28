import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { Button, ConfirmButton, Field, HorizontalGroup, Icon, Modal, stylesFactory, Tooltip, useStyles2, withTheme2, } from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions, updateUserRoles } from 'app/core/components/RolePicker/api';
import { OrgPicker } from 'app/core/components/Select/OrgPicker';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, OrgRole } from 'app/types';
import { OrgRolePicker } from './OrgRolePicker';
export class UserOrgs extends PureComponent {
    constructor() {
        super(...arguments);
        this.addToOrgButtonRef = React.createRef();
        this.state = {
            showAddOrgModal: false,
        };
        this.showOrgAddModal = () => {
            this.setState({ showAddOrgModal: true });
        };
        this.dismissOrgAddModal = () => {
            this.setState({ showAddOrgModal: false }, () => {
                var _a;
                (_a = this.addToOrgButtonRef.current) === null || _a === void 0 ? void 0 : _a.focus();
            });
        };
    }
    render() {
        const { user, orgs, isExternalUser, onOrgRoleChange, onOrgRemove, onOrgAdd } = this.props;
        const { showAddOrgModal } = this.state;
        const addToOrgContainerClass = css `
      margin-top: 0.8rem;
    `;
        const canAddToOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd) && !isExternalUser;
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" }, "Organizations"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("table", { className: "filter-table form-inline" },
                        React.createElement("tbody", null, orgs.map((org, index) => (React.createElement(OrgRow, { key: `${org.orgId}-${index}`, isExternalUser: isExternalUser, user: user, org: org, onOrgRoleChange: onOrgRoleChange, onOrgRemove: onOrgRemove })))))),
                React.createElement("div", { className: addToOrgContainerClass }, canAddToOrg && (React.createElement(Button, { variant: "secondary", onClick: this.showOrgAddModal, ref: this.addToOrgButtonRef }, "Add user to organization"))),
                React.createElement(AddToOrgModal, { user: user, userOrgs: orgs, isOpen: showAddOrgModal, onOrgAdd: onOrgAdd, onDismiss: this.dismissOrgAddModal }))));
    }
}
const getOrgRowStyles = stylesFactory((theme) => {
    return {
        removeButton: css `
      margin-right: 0.6rem;
      text-decoration: underline;
      color: ${theme.v1.palette.blue95};
    `,
        label: css `
      font-weight: 500;
    `,
        disabledTooltip: css `
      display: flex;
    `,
        tooltipItem: css `
      margin-left: 5px;
    `,
        tooltipItemLink: css `
      color: ${theme.v1.palette.blue95};
    `,
        rolePickerWrapper: css `
      display: flex;
    `,
        rolePicker: css `
      flex: auto;
      margin-right: ${theme.spacing(1)};
    `,
    };
});
class UnThemedOrgRow extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            currentRole: this.props.org.role,
            isChangingRole: false,
            roleOptions: [],
        };
        this.onOrgRemove = () => __awaiter(this, void 0, void 0, function* () {
            const { org } = this.props;
            this.props.onOrgRemove(org.orgId);
        });
        this.onChangeRoleClick = () => {
            const { org } = this.props;
            this.setState({ isChangingRole: true, currentRole: org.role });
        };
        this.onOrgRoleChange = (newRole) => {
            this.setState({ currentRole: newRole });
        };
        this.onOrgRoleSave = () => {
            this.props.onOrgRoleChange(this.props.org.orgId, this.state.currentRole);
        };
        this.onCancelClick = () => {
            this.setState({ isChangingRole: false });
        };
        this.onBasicRoleChange = (newRole) => {
            this.props.onOrgRoleChange(this.props.org.orgId, newRole);
        };
    }
    componentDidMount() {
        if (contextSrv.licensedAccessControlEnabled()) {
            if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
                fetchRoleOptions(this.props.org.orgId)
                    .then((roles) => this.setState({ roleOptions: roles }))
                    .catch((e) => console.error(e));
            }
        }
    }
    render() {
        var _a;
        const { user, org, isExternalUser, theme } = this.props;
        const authSource = ((_a = user === null || user === void 0 ? void 0 : user.authLabels) === null || _a === void 0 ? void 0 : _a.length) && (user === null || user === void 0 ? void 0 : user.authLabels[0]);
        const lockMessage = authSource ? `Synced via ${authSource}` : '';
        const { currentRole, isChangingRole } = this.state;
        const styles = getOrgRowStyles(theme);
        const labelClass = cx('width-16', styles.label);
        const canChangeRole = contextSrv.hasPermission(AccessControlAction.OrgUsersWrite);
        const canRemoveFromOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersRemove) && !isExternalUser;
        const rolePickerDisabled = isExternalUser || !canChangeRole;
        const inputId = `${org.name}-input`;
        return (React.createElement("tr", null,
            React.createElement("td", { className: labelClass },
                React.createElement("label", { htmlFor: inputId }, org.name)),
            contextSrv.licensedAccessControlEnabled() ? (React.createElement("td", null,
                React.createElement("div", { className: styles.rolePickerWrapper },
                    React.createElement("div", { className: styles.rolePicker },
                        React.createElement(UserRolePicker, { userId: (user === null || user === void 0 ? void 0 : user.id) || 0, orgId: org.orgId, basicRole: org.role, roleOptions: this.state.roleOptions, onBasicRoleChange: this.onBasicRoleChange, basicRoleDisabled: rolePickerDisabled, basicRoleDisabledMessage: "This user's role is not editable because it is synchronized from your auth provider.\n                    Refer to the Grafana authentication docs for details." })),
                    isExternalUser && React.createElement(ExternalUserTooltip, { lockMessage: lockMessage })))) : (React.createElement(React.Fragment, null,
                isChangingRole ? (React.createElement("td", null,
                    React.createElement(OrgRolePicker, { inputId: inputId, value: currentRole, onChange: this.onOrgRoleChange, autoFocus: true }))) : (React.createElement("td", { className: "width-25" }, org.role)),
                React.createElement("td", { colSpan: 1 },
                    React.createElement("div", { className: "pull-right" }, canChangeRole && (React.createElement(ChangeOrgButton, { lockMessage: lockMessage, isExternalUser: isExternalUser, onChangeRoleClick: this.onChangeRoleClick, onCancelClick: this.onCancelClick, onOrgRoleSave: this.onOrgRoleSave })))))),
            React.createElement("td", { colSpan: 1 },
                React.createElement("div", { className: "pull-right" }, canRemoveFromOrg && (React.createElement(ConfirmButton, { confirmText: "Confirm removal", confirmVariant: "destructive", onCancel: this.onCancelClick, onConfirm: this.onOrgRemove, autoFocus: true }, "Remove from organization"))))));
    }
}
const OrgRow = withTheme2(UnThemedOrgRow);
const getAddToOrgModalStyles = stylesFactory(() => ({
    modal: css `
    width: 500px;
  `,
    buttonRow: css `
    text-align: center;
  `,
    modalContent: css `
    overflow: visible;
  `,
}));
export class AddToOrgModal extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            selectedOrg: null,
            role: OrgRole.Viewer,
            roleOptions: [],
            pendingOrgId: null,
            pendingUserId: null,
            pendingRoles: [],
        };
        this.onOrgSelect = (org) => {
            var _a;
            const userOrg = this.props.userOrgs.find((userOrg) => { var _a; return userOrg.orgId === ((_a = org.value) === null || _a === void 0 ? void 0 : _a.id); });
            this.setState({ selectedOrg: org.value, role: (userOrg === null || userOrg === void 0 ? void 0 : userOrg.role) || OrgRole.Viewer });
            if (contextSrv.licensedAccessControlEnabled()) {
                if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
                    fetchRoleOptions((_a = org.value) === null || _a === void 0 ? void 0 : _a.id)
                        .then((roles) => this.setState({ roleOptions: roles }))
                        .catch((e) => console.error(e));
                }
            }
        };
        this.onOrgRoleChange = (newRole) => {
            this.setState({
                role: newRole,
            });
        };
        this.onAddUserToOrg = () => __awaiter(this, void 0, void 0, function* () {
            const { selectedOrg, role } = this.state;
            this.props.onOrgAdd(selectedOrg.id, role);
            // add the stored userRoles also
            if (contextSrv.licensedAccessControlEnabled()) {
                if (contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd)) {
                    if (this.state.pendingUserId) {
                        yield updateUserRoles(this.state.pendingRoles, this.state.pendingUserId, this.state.pendingOrgId);
                        // clear pending state
                        this.setState({
                            pendingOrgId: null,
                            pendingRoles: [],
                            pendingUserId: null,
                        });
                    }
                }
            }
        });
        this.onCancel = () => {
            // clear selectedOrg when modal is canceled
            this.setState({
                selectedOrg: null,
                pendingRoles: [],
                pendingOrgId: null,
                pendingUserId: null,
            });
            if (this.props.onDismiss) {
                this.props.onDismiss();
            }
        };
        this.onRoleUpdate = (roles, userId, orgId) => __awaiter(this, void 0, void 0, function* () {
            // keep the new role assignments for user
            this.setState({
                pendingRoles: roles,
                pendingOrgId: orgId,
                pendingUserId: userId,
            });
        });
    }
    render() {
        const { isOpen, user, userOrgs } = this.props;
        const { role, roleOptions, selectedOrg } = this.state;
        const styles = getAddToOrgModalStyles();
        return (React.createElement(Modal, { className: styles.modal, contentClassName: styles.modalContent, title: "Add to an organization", isOpen: isOpen, onDismiss: this.onCancel },
            React.createElement(Field, { label: "Organization" },
                React.createElement(OrgPicker, { inputId: "new-org-input", onSelected: this.onOrgSelect, excludeOrgs: userOrgs, autoFocus: true })),
            React.createElement(Field, { label: "Role", disabled: selectedOrg === null },
                React.createElement(UserRolePicker, { userId: (user === null || user === void 0 ? void 0 : user.id) || 0, orgId: selectedOrg === null || selectedOrg === void 0 ? void 0 : selectedOrg.id, basicRole: role, onBasicRoleChange: this.onOrgRoleChange, basicRoleDisabled: false, roleOptions: roleOptions, apply: true, onApplyRoles: this.onRoleUpdate, pendingRoles: this.state.pendingRoles })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(HorizontalGroup, { spacing: "md", justify: "center" },
                    React.createElement(Button, { variant: "secondary", fill: "outline", onClick: this.onCancel }, "Cancel"),
                    React.createElement(Button, { variant: "primary", disabled: selectedOrg === null, onClick: this.onAddUserToOrg }, "Add to organization")))));
    }
}
const getChangeOrgButtonTheme = (theme) => ({
    disabledTooltip: css `
    display: flex;
  `,
    tooltipItemLink: css `
    color: ${theme.v1.palette.blue95};
  `,
    lockMessageClass: css `
    font-style: italic;
    margin-left: 1.8rem;
    margin-right: 0.6rem;
  `,
    icon: css `
    line-height: 2;
  `,
});
export function ChangeOrgButton({ lockMessage, onChangeRoleClick, isExternalUser, onOrgRoleSave, onCancelClick, }) {
    const styles = useStyles2(getChangeOrgButtonTheme);
    return (React.createElement("div", { className: styles.disabledTooltip }, isExternalUser ? (React.createElement(React.Fragment, null,
        React.createElement("span", { className: styles.lockMessageClass }, lockMessage),
        React.createElement(Tooltip, { placement: "right-end", interactive: true, content: React.createElement("div", null,
                "This user's role is not editable because it is synchronized from your auth provider. Refer to the\u00A0",
                React.createElement("a", { className: styles.tooltipItemLink, href: 'https://grafana.com/docs/grafana/latest/auth', rel: "noreferrer", target: "_blank" }, "Grafana authentication docs"),
                "\u00A0for details.") },
            React.createElement("div", { className: styles.icon },
                React.createElement(Icon, { name: "question-circle" }))))) : (React.createElement(ConfirmButton, { confirmText: "Save", onClick: onChangeRoleClick, onCancel: onCancelClick, onConfirm: onOrgRoleSave, disabled: isExternalUser }, "Change role"))));
}
export const ExternalUserTooltip = ({ lockMessage }) => {
    const styles = useStyles2(getTooltipStyles);
    return (React.createElement("div", { className: styles.disabledTooltip },
        React.createElement("span", { className: styles.lockMessageClass }, lockMessage),
        React.createElement(Tooltip, { placement: "right-end", interactive: true, content: React.createElement("div", null,
                "This user's built-in role is not editable because it is synchronized from your auth provider. Refer to the\u00A0",
                React.createElement("a", { className: styles.tooltipItemLink, href: 'https://grafana.com/docs/grafana/latest/auth', rel: "noreferrer noopener", target: "_blank" }, "Grafana authentication docs"),
                "\u00A0for details.") },
            React.createElement(Icon, { name: "question-circle" }))));
};
const getTooltipStyles = (theme) => ({
    disabledTooltip: css `
    display: flex;
  `,
    tooltipItemLink: css `
    color: ${theme.v1.palette.blue95};
  `,
    lockMessageClass: css `
    font-style: italic;
    margin-left: 1.8rem;
    margin-right: 0.6rem;
  `,
});
//# sourceMappingURL=UserOrgs.js.map