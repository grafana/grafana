import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { dateTimeFormat } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { ServiceAccountProfileRow } from './ServiceAccountProfileRow';
import { ServiceAccountRoleRow } from './ServiceAccountRoleRow';
export function ServiceAccountProfile({ serviceAccount, timeZone, onChange }) {
    const styles = useStyles2(getStyles);
    const ableToWrite = contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);
    const [roles, setRoleOptions] = React.useState([]);
    const onRoleChange = (role) => {
        onChange(Object.assign(Object.assign({}, serviceAccount), { role: role }));
    };
    const onNameChange = (newValue) => {
        onChange(Object.assign(Object.assign({}, serviceAccount), { name: newValue }));
    };
    React.useEffect(() => {
        function fetchOptions() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
                        let options = yield fetchRoleOptions(serviceAccount.orgId);
                        setRoleOptions(options);
                    }
                }
                catch (e) {
                    console.error('Error loading options for service account');
                }
            });
        }
        if (contextSrv.licensedAccessControlEnabled()) {
            fetchOptions();
        }
    }, [serviceAccount.orgId]);
    return (React.createElement("div", { className: styles.section },
        React.createElement("h3", null, "Information"),
        React.createElement("table", { className: "filter-table" },
            React.createElement("tbody", null,
                React.createElement(ServiceAccountProfileRow, { label: "Name", value: serviceAccount.name, onChange: onNameChange, disabled: !ableToWrite || serviceAccount.isDisabled }),
                React.createElement(ServiceAccountProfileRow, { label: "ID", value: serviceAccount.login, disabled: serviceAccount.isDisabled }),
                React.createElement(ServiceAccountRoleRow, { label: "Roles", serviceAccount: serviceAccount, onRoleChange: onRoleChange, roleOptions: roles }),
                React.createElement(ServiceAccountProfileRow, { label: "Creation date", value: dateTimeFormat(serviceAccount.createdAt, { timeZone }), disabled: serviceAccount.isDisabled })))));
}
export const getStyles = (theme) => ({
    section: css `
    margin-bottom: ${theme.spacing(4)};
  `,
});
//# sourceMappingURL=ServiceAccountProfile.js.map