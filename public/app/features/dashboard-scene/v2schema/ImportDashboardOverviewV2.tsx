import { useState } from 'react';

import { locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { Form } from 'app/core/components/Form/Form';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { clearLoadedDashboard } from 'app/features/manage-dashboards/state/actions';
import { useDispatch, useSelector, StoreState } from 'app/types';

import { ImportDashboardFormV2 } from './ImportDashboardFormV2';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

export function ImportDashboardOverviewV2() {
  const [uidReset, setUidReset] = useState(false);
  const dispatch = useDispatch();

  // Get state from Redux store
  const searchObj = locationService.getSearchObject();
  const dashboard = useSelector((state: StoreState) => state.importDashboard.dashboard);
  const meta = useSelector((state: StoreState) => state.importDashboard.meta);
  const source = useSelector((state: StoreState) => state.importDashboard.source);
  const inputs = useSelector((state: StoreState) => state.importDashboard.inputs);
  const folder = searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' };

  function onUidReset() {
    setUidReset(true);
  }

  function onCancel() {
    dispatch(clearLoadedDashboard());
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

  return (
    <>
      <Form<DashboardV2Spec>
        onSubmit={() => onSubmit({ dashboard })}
        defaultValues={dashboard}
        validateOnMount
        validateFieldsOnMount={['title']}
        validateOn="onChange"
      >
        {({ register, errors, control, watch, getValues }) => (
          <ImportDashboardFormV2
            register={register}
            inputs={inputs}
            errors={errors}
            control={control}
            getValues={getValues}
            uidReset={uidReset}
            onCancel={onCancel}
            onUidReset={onUidReset}
            onSubmit={onSubmit}
            watch={watch}
          />
        )}
      </Form>
    </>
  );
}
