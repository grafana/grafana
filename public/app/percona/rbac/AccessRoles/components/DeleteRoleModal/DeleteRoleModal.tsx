import React, { FC, useMemo } from 'react';

import { AppEvents } from '@grafana/data';
import { Button, Form, InputControl, Modal, Select } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { deleteRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { getAccessRoles, getDefaultRole, getUsers, getUsersInfo } from 'app/percona/shared/core/selectors';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Messages } from '../../AccessRole.messages';

import { DeleteRoleFormValues, DeleteRoleModalProps } from './DeleteRoleModal.types';
import { getDefaultFormValues, getOptions, isRoleAssigned } from './DeleteRoleModal.utils';

const DeleteRoleModal: FC<React.PropsWithChildren<DeleteRoleModalProps>> = ({ role, isOpen, onCancel }) => {
  const dispatch = useAppDispatch();
  const { roles } = useSelector(getAccessRoles);
  const defaultRole = useSelector(getDefaultRole);
  const { users } = useSelector(getUsers);
  const { users: usersInfo } = useSelector(getUsersInfo);
  const options = useMemo(() => getOptions(roles, role), [roles, role]);
  const defaultValues = useMemo(() => getDefaultFormValues(defaultRole), [defaultRole]);
  const isAssigned = useMemo(() => isRoleAssigned(role, usersInfo, users), [users, usersInfo, role]);

  const handleDelete = async (values: DeleteRoleFormValues) => {
    try {
      await dispatch(
        deleteRoleAction({
          toDeleteId: role.roleId,
          replacementRoleId: values.replacementRoleId.value!,
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
      <Form defaultValues={defaultValues} onSubmit={handleDelete} maxWidth="none">
        {({ formState, control }) => (
          <>
            {isAssigned ? (
              <>
                <p>{Messages.delete.description(role.title)}</p>
                <InputControl
                  control={control}
                  name="replacementRoleId"
                  render={({ field }) => (
                    <Select
                      aria-label={Messages.delete.replacementAriaLabel}
                      getOptionValue={(item) => item.value}
                      options={options}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </>
            ) : (
              <p>{Messages.delete.descriptionNonAssigned}</p>
            )}
            <Modal.ButtonRow>
              <Button type="submit" disabled={formState.isSubmitting}>
                {Messages.delete.submit}
              </Button>
              <Button variant="secondary" onClick={onCancel}>
                {Messages.delete.cancel}
              </Button>
            </Modal.ButtonRow>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default DeleteRoleModal;
