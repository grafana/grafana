import { FC, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { AppEvents, PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { appEvents } from 'app/core/core';
import {
  PMM_ACCESS_ROLES_PAGE,
  PMM_ACCESS_ROLE_EDIT_PAGE,
} from 'app/percona/shared/components/PerconaBootstrapper/PerconaNavigation/PerconaNavigation.constants';
import { updateRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { logger } from 'app/percona/shared/helpers/logger';
import RolesService from 'app/percona/shared/services/roles/Roles.service';
import { useAppDispatch } from 'app/store/store';

import AddEditRoleForm, { AddEditFormValues } from '../components/AddEditRoleForm';

import { Messages } from './EditRolePage.messages';
import { EditRolePageParams } from './EditRolePage.types';

const EditRolePage: FC = () => {
  const dispatch = useAppDispatch();
  const { id } = useParams() as EditRolePageParams;
  const [role, setRole] = useState<AddEditFormValues>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async (id: string) => {
      setIsLoading(true);
      try {
        const role = await RolesService.get(parseInt(id, 10));
        setRole(role);
      } catch (error) {
        logger.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchRole(id);
    }
  }, [id]);

  const handleSubmit = async (values: AddEditFormValues) => {
    if (!id) {
      return;
    }

    try {
      await dispatch(
        updateRoleAction({
          roleId: Number(id),
          ...values,
        })
      ).unwrap();
      appEvents.emit(AppEvents.alertSuccess, [Messages.success.title(values.title), Messages.success.body]);
      locationService.push('/roles');
    } catch (e) {
      logger.error(e);
    }
  };

  const handleCancel = () => {
    locationService.push('/roles');
  };

  return (
    <Page navId={PMM_ACCESS_ROLES_PAGE.id} pageNav={PMM_ACCESS_ROLE_EDIT_PAGE} layout={PageLayoutType.Custom}>
      <AddEditRoleForm
        isLoading={isLoading}
        initialValues={role}
        title={Messages.title}
        cancelLabel={Messages.cancel}
        onCancel={handleCancel}
        submitLabel={Messages.submit}
        onSubmit={handleSubmit}
      />
    </Page>
  );
};

export default EditRolePage;
