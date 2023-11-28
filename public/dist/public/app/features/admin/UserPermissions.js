import { css } from '@emotion/css';
import React, { useState } from 'react';
import { ConfirmButton, RadioButtonGroup, Icon, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { ExternalUserTooltip } from 'app/features/admin/UserOrgs';
import { AccessControlAction } from 'app/types';
const adminOptions = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
];
export function UserPermissions({ isGrafanaAdmin, isExternalUser, lockMessage, onGrafanaAdminChange }) {
    const [isEditing, setIsEditing] = useState(false);
    const [currentAdminOption, setCurrentAdminOption] = useState(isGrafanaAdmin);
    const onChangeClick = () => setIsEditing(true);
    const onCancelClick = () => {
        setIsEditing(false);
        setCurrentAdminOption(isGrafanaAdmin);
    };
    const handleGrafanaAdminChange = () => onGrafanaAdminChange(currentAdminOption);
    const canChangePermissions = contextSrv.hasPermission(AccessControlAction.UsersPermissionsUpdate) && !isExternalUser;
    const styles = useStyles2(getTooltipStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Permissions"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form" },
                React.createElement("table", { className: "filter-table form-inline" },
                    React.createElement("tbody", null,
                        React.createElement("tr", null,
                            React.createElement("td", { className: "width-16" }, "Grafana Admin"),
                            isEditing ? (React.createElement("td", { colSpan: 2 },
                                React.createElement(RadioButtonGroup, { options: adminOptions, value: currentAdminOption, onChange: setCurrentAdminOption, autoFocus: true }))) : (React.createElement("td", { colSpan: 2 }, isGrafanaAdmin ? (React.createElement(React.Fragment, null,
                                React.createElement(Icon, { name: "shield" }),
                                " Yes")) : (React.createElement(React.Fragment, null, "No")))),
                            React.createElement("td", null,
                                canChangePermissions && (React.createElement(ConfirmButton, { onClick: onChangeClick, onConfirm: handleGrafanaAdminChange, onCancel: onCancelClick, confirmText: "Change" }, "Change")),
                                isExternalUser && (React.createElement("div", { className: styles.lockMessageClass },
                                    React.createElement(ExternalUserTooltip, { lockMessage: lockMessage })))))))))));
}
const getTooltipStyles = (theme) => ({
    lockMessageClass: css `
    display: flex;
    justify-content: flex-end;
    font-style: italic;
    margin-right: ${theme.spacing(0.6)};
  `,
});
//# sourceMappingURL=UserPermissions.js.map