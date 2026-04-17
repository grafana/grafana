import { useMemo } from 'react';

import { invalidateQuotaUsage } from '@grafana/api-clients/rtkq/quotas/v0alpha1';
import { AppEvents, locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';
import { Form } from 'app/core/components/Form/Form';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { refetchChildren } from 'app/features/browse-dashboards/state/actions';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { useDispatch } from 'app/types/store';

import { type DashboardInputs, DashboardSource, type ImportFormDataV2 } from '../../types';
import { truncateFloatGridItems } from '../utils/floatingGridItems';
import { applyV2Inputs } from '../utils/inputs';

import { GcomDashboardInfo } from './GcomDashboardInfo';
import { ImportDashboardFormV2 } from './ImportDashboardFormV2';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

type Props = {
  dashboard: DashboardV2Spec;
  dashboardUid?: string;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  folderUid: string;
  onCancel: () => void;
};

export function ImportOverviewV2({ dashboard, dashboardUid, inputs, meta, source, folderUid, onCancel }: Props) {
  const dispatch = useDispatch();
  const { layout: normalizedLayout, modified: hasFloatGridItems } = useMemo(
    () => truncateFloatGridItems(dashboard.layout),
    [dashboard.layout]
  );

  async function onSubmit(form: ImportFormDataV2) {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    try {
      const dashboardToSave: DashboardV2Spec = hasFloatGridItems
        ? { ...dashboard, layout: normalizedLayout }
        : dashboard;

      const dashboardWithDataSources = {
        ...applyV2Inputs(dashboardToSave, form),
        title: form.dashboard.title,
      };

      const api = await getDashboardAPI('v2');
      const result = await api.saveDashboard({
        ...form,
        dashboard: dashboardWithDataSources,
      });

      // The v2 save path goes directly through the app-platform Dashboard client and bypasses
      // RTK Query, so we have to invalidate the browse-folder cache ourselves. Otherwise the
      // newly-imported dashboard does not appear in the destination folder until a hard refresh.
      dispatch(refetchChildren({ parentUID: form.folderUid, pageSize: PAGE_SIZE }));
      invalidateQuotaUsage(dispatch);

      if (result.url) {
        const dashboardUrl = locationUtil.stripBaseFromUrl(result.url);
        locationService.push(dashboardUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      appEvents.emit(AppEvents.alertError, ['Dashboard import failed', message]);
    }
  }

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={undefined} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <Form<ImportFormDataV2>
        onSubmit={onSubmit}
        defaultValues={{
          dashboard: dashboard,
          folderUid: folderUid,
          k8s: {
            ...(dashboardUid !== undefined ? { name: dashboardUid } : {}),
            annotations: { 'grafana.app/folder': folderUid },
          },
        }}
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
            hasFloatGridItems={hasFloatGridItems}
          />
        )}
      </Form>
    </>
  );
}
