import { __awaiter } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import { AppEvents } from '@grafana/data';
import { Select } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { assignRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { getAccessRoles, getUsersInfo } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { Messages } from './AccessRoleCell.messages';
import { idsToOptions, toOptions } from './AccessRoleCell.utils';
const AccessRoleCell = ({ user }) => {
    const userId = useMemo(() => ('userId' in user ? user.userId : user.id), [user]);
    const dispatch = useAppDispatch();
    const { roles, isLoading: rolesLoading } = useSelector(getAccessRoles);
    const { usersMap, isLoading: usersLoading } = useSelector(getUsersInfo);
    const roleIds = useMemo(() => { var _a; return ((_a = usersMap[userId]) === null || _a === void 0 ? void 0 : _a.roleIds) || []; }, [usersMap, userId]);
    const options = useMemo(() => toOptions(roles), [roles]);
    const [value, setValue] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    useEffect(() => {
        setValue(idsToOptions(roleIds, roles));
    }, [roles, roleIds]);
    const handleChange = (selected) => __awaiter(void 0, void 0, void 0, function* () {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const roleIds = selected;
        setValue(roleIds);
        // value will always be defined
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const ids = roleIds.map((v) => v.value);
        const payload = {
            roleIds: ids,
            userId: userId,
        };
        yield dispatch(assignRoleAction(payload));
        appEvents.emit(AppEvents.alertSuccess, [Messages.success.title(user.name || user.login), Messages.success.body]);
    });
    return (React.createElement("td", null,
        React.createElement(Select, { "aria-label": Messages.label, isMulti: isOpen || value.length !== 1, value: value, onChange: handleChange, options: options, isClearable: false, closeMenuOnSelect: false, isLoading: rolesLoading || usersLoading, onOpenMenu: () => setIsOpen(true), onCloseMenu: () => setIsOpen(false) })));
};
export default AccessRoleCell;
//# sourceMappingURL=AccessRoleCell.js.map