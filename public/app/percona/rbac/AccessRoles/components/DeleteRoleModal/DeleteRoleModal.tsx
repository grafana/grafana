import { logger } from '@percona/platform-core';
import React, { FC, useMemo } from 'react';

import { AppEvents } from '@grafana/data';
import { Button, Modal } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { deleteRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { getUsersInfo } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Messages } from '../../AccessRole.messages';

import { DeleteRoleModalProps } from './DeleteRoleModal.types';

const DeleteRoleModal: FC<DeleteRoleModalProps> = ({ role, isOpen, onCancel }) => {
  const dispatch = useAppDispatch();
  const { users } = useSelector(getUsersInfo);
  const isAssigned = useMemo(() => users.some((u) => u.roleIds.includes(role.roleId)), [role, users]);

  const handleDelete = async () => {
    try {
      await dispatch(
        deleteRoleAction({
          toDeleteId: role.roleId,
        })
      ).unwrap();
      appEvents.emit(AppEvents.alertSuccess, [Messages.delete.success.title(role.title), Messages.delete.success.body]);
      onCancel();
    } catch (e) {
      logger.error(e);
    }
  };

  return (
    <Modal isOpen={isOpen} title={Messages.delete.title(role.title)} onDismiss={onCancel}>
      {isAssigned ? <p>{Messages.delete.assigned(role.title)}</p> : <p>{Messages.delete.description}</p>}
      <Modal.ButtonRow>
        {!isAssigned && <Button onClick={handleDelete}>{Messages.delete.submit}</Button>}
        <Button variant="secondary" onClick={onCancel}>
          {Messages.delete.cancel}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export default DeleteRoleModal;
