import { AppEvents, locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { appEvents } from 'app/core/app_events';
import { Form } from 'app/core/components/Form/Form';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

import { DashboardInputs, DashboardSource, ImportFormDataV2 } from '../../types';
import { applyV2Inputs } from '../utils/inputs';

import { GcomDashboardInfo } from './GcomDashboardInfo';
import { ImportDashboardFormV2 } from './ImportDashboardFormV2';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

type Props = {
  dashboard: DashboardV2Spec;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  folderUid: string;
  onCancel: () => void;
};

export function ImportOverviewV2({ dashboard, inputs, meta, source, folderUid, onCancel }: Props) {
  async function onSubmit(form: ImportFormDataV2) {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    try {
      const dashboardWithDataSources = {
        ...applyV2Inputs(dashboard, form),
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
          k8s: { annotations: { 'grafana.app/folder': folderUid } },
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
          />
        )}
      </Form>
    </>
  );
}
