import { useState } from 'react';

import { locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { Form } from 'app/core/components/Form/Form';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';

import { ImportDashboardFormV2 } from './ImportDashboardFormV2';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

type Props = {
  dashboard: DashboardV2Spec;
};

export function ImportDashboardOverviewV2({ dashboard }: Props) {
  const [uidReset, setUidReset] = useState(false);

  function onUidReset() {
    setUidReset(true);
  }

  return (
    <>
      <Form<SaveDashboardCommand<DashboardV2Spec>>
        onSubmit={() => onSubmit({ dashboard })}
        defaultValues={{ dashboard }}
        validateOnMount
        validateFieldsOnMount={['dashboard.title']}
        validateOn="onChange"
      >
        {({ register, errors, control, watch, getValues }) => (
          <ImportDashboardFormV2
            register={register}
            errors={errors}
            control={control}
            getValues={getValues}
            uidReset={uidReset}
            onCancel={onCancel}
            onUidReset={onUidReset}
            onSubmit={() => onSubmit({ dashboard })}
            watch={watch}
          />
        )}
      </Form>
    </>
  );
}

async function onSubmit(form: SaveDashboardCommand<DashboardV2Spec>) {
  reportInteraction(IMPORT_FINISHED_EVENT_NAME);

  console.log('form', form);

  const result = await getDashboardAPI('v2').saveDashboard(form);

  if (result.url) {
    console.log('getting the url');
    const dashboardUrl = locationUtil.stripBaseFromUrl(result.url);
    locationService.push(dashboardUrl);
  }
}

// TODO:
function onCancel() {}
