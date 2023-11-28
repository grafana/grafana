import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { locationService } from '@grafana/runtime';
import { Dropdown, IconButton, Menu } from '@grafana/ui';
import { fetchSettingsAction } from 'app/percona/shared/core/reducers';
import { setAsDefaultRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { Messages } from '../../AccessRole.messages';
import DeleteRoleModal from '../DeleteRoleModal';
import { styles } from './OptionsCell.styles';
const OptionsCell = ({ role }) => {
    const dispatch = useAppDispatch();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const handleSetAsDefault = () => __awaiter(void 0, void 0, void 0, function* () {
        if (role.isDefault) {
            return;
        }
        try {
            yield dispatch(setAsDefaultRoleAction(role.roleId));
            yield dispatch(fetchSettingsAction());
        }
        catch (e) {
            logger.error(e);
        }
    });
    const handleEdit = () => {
        locationService.push(`/roles/${role.roleId}/edit`);
    };
    const handleDelete = () => {
        if (role.isDefault) {
            return;
        }
        setDeleteModalOpen(true);
    };
    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
    };
    const menu = () => (React.createElement(Menu, null,
        React.createElement(Menu.Item, { label: Messages.options.edit, icon: "pen", onClick: handleEdit }),
        !role.isDefault && (React.createElement(React.Fragment, null,
            React.createElement(Menu.Item, { label: Messages.options.default, icon: "user-check", onClick: handleSetAsDefault }),
            React.createElement(Menu.Item, { label: Messages.options.delete, icon: "trash-alt", onClick: handleDelete })))));
    return (React.createElement("div", { className: styles.Cell },
        React.createElement(DeleteRoleModal, { isOpen: deleteModalOpen, onCancel: handleDeleteCancel, role: role }),
        React.createElement(Dropdown, { overlay: menu },
            React.createElement(IconButton, { "aria-label": Messages.options.iconLabel, name: "ellipsis-v" }))));
};
export default OptionsCell;
//# sourceMappingURL=OptionsCell.js.map