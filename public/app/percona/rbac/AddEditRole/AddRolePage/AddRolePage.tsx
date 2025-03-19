import { FC } from 'react';

import { AppEvents, PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import {
  PMM_ACCESS_ROLE_CREATE_PAGE,
  PMM_ACCESS_ROLES_PAGE,
} from 'app/percona/shared/components/PerconaBootstrapper/PerconaNavigation';
import { createRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';

import AddEditRoleForm, { AddEditFormValues } from '../components/AddEditRoleForm';

import { Messages } from './AddRolePage.messages';

const AddRolePage: FC = () => {
  const dispatch = useAppDispatch();

  const handleSubmit = async (values: AddEditFormValues) => {
    try {
      await dispatch(createRoleAction(values)).unwrap();
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
    <Page navId={PMM_ACCESS_ROLES_PAGE.id} pageNav={PMM_ACCESS_ROLE_CREATE_PAGE} layout={PageLayoutType.Custom}>
      <AddEditRoleForm
        title={Messages.title}
        cancelLabel={Messages.cancel}
        onCancel={handleCancel}
        submitLabel={Messages.submit}
        onSubmit={handleSubmit}
      />
    </Page>
  );
};

export default AddRolePage;
