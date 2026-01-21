import { locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Form } from 'app/core/components/Form/Form';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { clearLoadedDashboard } from 'app/features/manage-dashboards/state/actions';
import { useDispatch, useSelector, StoreState } from 'app/types/store';

import { ImportDashboardFormV2 } from './ImportDashboardFormV2';
import { replaceDatasourcesInDashboard, DatasourceMappings } from './importDatasourceReplacer';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

type FormData = SaveDashboardCommand<DashboardV2Spec> & { [key: `datasource-${string}`]: string };

export function ImportDashboardOverviewV2() {
  const dispatch = useDispatch();

  // Get state from Redux store
  const searchObj = locationService.getSearchObject();
  const dashboard = useSelector((state: StoreState) => state.importDashboard.dashboard as DashboardV2Spec);
  const inputs = useSelector((state: StoreState) => state.importDashboard.inputs);
  const folder = searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' };

  function onCancel() {
    dispatch(clearLoadedDashboard());
  }

  async function onSubmit(form: FormData) {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    // Build datasource mappings from form
    const mappings: DatasourceMappings = {};
    for (const key of Object.keys(form)) {
      if (key.startsWith('datasource-')) {
        const dsType = key.replace('datasource-', '');
        const ds = form[key as keyof typeof form] as { uid: string; type: string; name?: string } | undefined;
        if (ds?.uid) {
          mappings[dsType] = { uid: ds.uid, type: ds.type, name: ds.name };
        }
      }
    }

    const dashboardWithDataSources: DashboardV2Spec = {
      ...replaceDatasourcesInDashboard(dashboard, mappings),
      title: form.dashboard.title,
    };

    const result = await getDashboardAPI('v2').saveDashboard({
      ...form,
      dashboard: dashboardWithDataSources,
    });

    if (result.url) {
      const dashboardUrl = locationUtil.stripBaseFromUrl(result.url);
      locationService.push(dashboardUrl);
    }
  }

  return (
    <>
      <Form<FormData>
        onSubmit={onSubmit}
        defaultValues={{ dashboard, folderUid: folder.uid, k8s: { annotations: { 'grafana.app/folder': folder.uid } } }}
        validateOnMount
        validateOn="onChange"
      >
        {({ register, errors, control, watch, getValues }) => (
          <ImportDashboardFormV2
            register={register}
            inputs={inputs}
            errors={errors}
            control={control}
            getValues={getValues}
            onCancel={onCancel}
            onSubmit={onSubmit}
            watch={watch}
          />
        )}
      </Form>
    </>
  );
}
