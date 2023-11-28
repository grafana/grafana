import { __awaiter } from "tslib";
import React, { useMemo } from 'react';
import { AppEvents } from '@grafana/data';
import { Button, Form, InputControl, Modal, Select } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { deleteRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { getAccessRoles, getDefaultRole, getUsers, getUsersInfo } from 'app/percona/shared/core/selectors';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { Messages } from '../../AccessRole.messages';
import { getDefaultFormValues, getOptions, isRoleAssigned } from './DeleteRoleModal.utils';
const DeleteRoleModal = ({ role, isOpen, onCancel }) => {
    const dispatch = useAppDispatch();
    const { roles } = useSelector(getAccessRoles);
    const defaultRole = useSelector(getDefaultRole);
    const { users } = useSelector(getUsers);
    const { users: usersInfo } = useSelector(getUsersInfo);
    const options = useMemo(() => getOptions(roles, role), [roles, role]);
    const defaultValues = useMemo(() => getDefaultFormValues(defaultRole), [defaultRole]);
    const isAssigned = useMemo(() => isRoleAssigned(role, usersInfo, users), [users, usersInfo, role]);
    const handleDelete = (values) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield dispatch(deleteRoleAction({
                toDeleteId: role.roleId,
                replacementRoleId: values.replacementRoleId.value,
            })).unwrap();
            appEvents.emit(AppEvents.alertSuccess, [Messages.delete.success.title(role.title), Messages.delete.success.body]);
            onCancel();
        }
        catch (e) {
            logger.error(e);
        }
    });
    return (React.createElement(Modal, { isOpen: isOpen, title: Messages.delete.title(role.title), onDismiss: onCancel },
        React.createElement(Form, { defaultValues: defaultValues, onSubmit: handleDelete, maxWidth: "none" }, ({ formState, control }) => (React.createElement(React.Fragment, null,
            isAssigned ? (React.createElement(React.Fragment, null,
                React.createElement("p", null, Messages.delete.description(role.title)),
                React.createElement(InputControl, { control: control, name: "replacementRoleId", render: ({ field }) => (React.createElement(Select, { "aria-label": Messages.delete.replacementAriaLabel, getOptionValue: (item) => item.value, options: options, value: field.value, onChange: field.onChange, onBlur: field.onBlur })) }))) : (React.createElement("p", null, Messages.delete.descriptionNonAssigned)),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "submit", disabled: formState.isSubmitting }, Messages.delete.submit),
                React.createElement(Button, { variant: "secondary", onClick: onCancel }, Messages.delete.cancel)))))));
};
export default DeleteRoleModal;
//# sourceMappingURL=DeleteRoleModal.js.map