import { useState } from 'react';

import { AppEvents, locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { appEvents } from 'app/core/app_events';
import { Form } from 'app/core/components/Form/Form';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { ImportDashboardFormV2 } from 'app/features/dashboard-scene/v2schema/ImportDashboardFormV2';
import { addLibraryPanel } from 'app/features/library-panels/state/api';

import { DashboardInputs, DashboardSource, ImportDashboardDTO, LibraryPanelInputState } from '../state/reducers';

import { GcomDashboardInfo } from './components/GcomDashboardInfo';
import { ImportForm } from './components/ImportForm';
import { ImportModel, isV1Dashboard, isV2Dashboard } from './detect';
import { applyV1DatasourceInputs, applyV2DatasourceInputs } from './transform';
import { ImportFormDataV2 } from './types';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

type Props = {
  dashboard: unknown;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  model: ImportModel;
  onCancel: () => void;
};

export function ImportOverview({ dashboard, inputs, meta, source, model, onCancel }: Props) {
  const [uidReset, setUidReset] = useState(false);
  const searchObj = locationService.getSearchObject();
  const folder = searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' };

  async function onSubmitV1(form: ImportDashboardDTO) {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const typedDashboard = dashboard as Dashboard | DashboardV2Spec;
    if (!isV1Dashboard(model, typedDashboard)) {
      return;
    }

    try {
      const dashboardWithDataSources = applyV1DatasourceInputs(typedDashboard, inputs, form);

      const newLibraryPanels = inputs.libraryPanels.filter((lp) => lp.state === LibraryPanelInputState.New);
      for (const lp of newLibraryPanels) {
        const libPanelWithPanelModel = new PanelModel(lp.model.model);
        let { scopedVars, ...panelSaveModel } = libPanelWithPanelModel.getSaveModel();
        panelSaveModel = {
          libraryPanel: {
            name: lp.model.name,
            uid: lp.model.uid,
          },
          ...panelSaveModel,
        };

        try {
          await addLibraryPanel(panelSaveModel, form.folder.uid);
        } catch (error) {
          appEvents.emit(AppEvents.alertWarning, [
            'Library panel import failed',
            `Could not import library panel "${lp.model.name}". It may already exist.`,
          ]);
        }
      }

      const dashboardK8SPayload: SaveDashboardCommand<Dashboard> = {
        dashboard: dashboardWithDataSources,
        k8s: {
          annotations: {
            'grafana.app/folder': form.folder.uid,
          },
        },
      };

      const result = await getDashboardAPI('v1').saveDashboard(dashboardK8SPayload);

      if (result.url) {
        const dashboardUrl = locationUtil.stripBaseFromUrl(result.url);
        locationService.push(dashboardUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      appEvents.emit(AppEvents.alertError, ['Dashboard import failed', message]);
    }
  }

  async function onSubmitV2(form: ImportFormDataV2) {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const typedDashboard = dashboard as Dashboard | DashboardV2Spec;
    if (!isV2Dashboard(model, typedDashboard)) {
      return;
    }

    try {
      const dashboardWithDataSources = {
        ...applyV2DatasourceInputs(typedDashboard, form),
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

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const typedDashboard = dashboard as Dashboard | DashboardV2Spec;
  const gnetId = getGnetId(model, typedDashboard);

  if (isV2Dashboard(model, typedDashboard)) {
    return (
      <>
        {source === DashboardSource.Gcom && (
          <GcomDashboardInfo gnetId={gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
        )}
        <Form<ImportFormDataV2>
          onSubmit={onSubmitV2}
          defaultValues={{
            dashboard: typedDashboard,
            folderUid: folder.uid,
            k8s: { annotations: { 'grafana.app/folder': folder.uid } },
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
              onSubmit={onSubmitV2}
              watch={watch}
            />
          )}
        </Form>
      </>
    );
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const v1Dashboard = typedDashboard as Dashboard;

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <Form
        onSubmit={onSubmitV1}
        defaultValues={{ ...v1Dashboard, constants: [], dataSources: [], elements: [], folder }}
        validateOnMount
        validateFieldsOnMount={['title', 'uid']}
        validateOn="onChange"
      >
        {({ register, errors, control, watch, getValues }) => (
          <ImportForm
            register={register}
            errors={errors}
            control={control}
            getValues={getValues}
            uidReset={uidReset}
            inputs={inputs}
            onCancel={onCancel}
            onUidReset={() => setUidReset(true)}
            onSubmit={onSubmitV1}
            watch={watch}
          />
        )}
      </Form>
    </>
  );
}

function getGnetId(model: ImportModel, dashboard: Dashboard | DashboardV2Spec) {
  if (isV1Dashboard(model, dashboard)) {
    return dashboard.gnetId;
  }

  return undefined;
}
