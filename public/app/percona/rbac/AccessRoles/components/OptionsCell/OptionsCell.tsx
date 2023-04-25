import React, { FC, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { Dropdown, IconButton, Menu } from '@grafana/ui';
import { fetchSettingsAction } from 'app/percona/shared/core/reducers';
import { setAsDefaultRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';

import { Messages } from '../../AccessRole.messages';
import DeleteRoleModal from '../DeleteRoleModal';

import { styles } from './OptionsCell.styles';
import { OptionsCellProps } from './OptionsCell.types';

const OptionsCell: FC<OptionsCellProps> = ({ role }) => {
  const dispatch = useAppDispatch();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleSetAsDefault = async () => {
    if (role.isDefault) {
      return;
    }

    try {
      await dispatch(setAsDefaultRoleAction(role.roleId));
      await dispatch(fetchSettingsAction());
    } catch (e) {
      logger.error(e);
    }
  };

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

  const menu = () => (
    <Menu>
      <Menu.Item label={Messages.options.edit} icon="pen" onClick={handleEdit} />
      {!role.isDefault && (
        <>
          <Menu.Item label={Messages.options.default} icon="user-check" onClick={handleSetAsDefault} />
          <Menu.Item label={Messages.options.delete} icon="trash-alt" onClick={handleDelete} />
        </>
      )}
    </Menu>
  );

  return (
    <div className={styles.Cell}>
      <DeleteRoleModal isOpen={deleteModalOpen} onCancel={handleDeleteCancel} role={role} />
      <Dropdown overlay={menu}>
        <IconButton ariaLabel={Messages.options.iconLabel} name="ellipsis-v" />
      </Dropdown>
    </div>
  );
};

export default OptionsCell;
