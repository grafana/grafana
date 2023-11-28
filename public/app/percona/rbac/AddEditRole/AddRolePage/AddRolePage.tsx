import React, { FC } from 'react';

import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { createRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';

import AddEditRoleForm, { AddEditFormValues } from '../components/AddEditRoleForm';

import { Messages } from './AddRolePage.messages';

const AddRolePage: FC<React.PropsWithChildren<unknown>> = () => {
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
    <Page>
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
