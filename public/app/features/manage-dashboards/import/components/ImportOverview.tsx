import { useState } from 'react';

import { AppEvents, locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { appEvents } from 'app/core/app_events';
import { Form } from 'app/core/components/Form/Form';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { isDashboardV1Spec, isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { addLibraryPanel } from 'app/features/library-panels/state/api';

import {
  DashboardInputs,
  DashboardSource,
  ImportDashboardDTO,
  ImportFormDataV2,
  LibraryPanelInputState,
} from '../types';
import { applyV1DatasourceInputs, applyV2DatasourceInputs } from '../utils/transform';

import { GcomDashboardInfo } from './GcomDashboardInfo';
import { ImportDashboardFormV2 } from './ImportDashboardFormV2';
import { ImportForm } from './ImportForm';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

type Props = {
  dashboard: unknown;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  onCancel: () => void;
};

export function ImportOverview({ dashboard, inputs, meta, source, onCancel }: Props) {
  const [uidReset, setUidReset] = useState(false);
  const searchObj = locationService.getSearchObject();
  const folder = searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' };

  async function onSubmitV1(form: ImportDashboardDTO) {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    if (!isDashboardV1Spec(dashboard)) {
      return;
    }

    try {
      const dashboardWithDataSources = applyV1DatasourceInputs(dashboard, inputs, form);

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

    if (!isDashboardV2Spec(dashboard)) {
      return;
    }

    try {
      const dashboardWithDataSources = {
        ...applyV2DatasourceInputs(dashboard, form),
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

  const gnetId = isDashboardV1Spec(dashboard) ? dashboard.gnetId : undefined;

  if (isDashboardV2Spec(dashboard)) {
    return (
      <>
        {source === DashboardSource.Gcom && (
          <GcomDashboardInfo gnetId={gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
        )}
        <Form<ImportFormDataV2>
          onSubmit={onSubmitV2}
          defaultValues={{
            dashboard: dashboard,
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

  if (!isDashboardV1Spec(dashboard)) {
    return null;
  }

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <Form
        onSubmit={onSubmitV1}
        defaultValues={{ ...dashboard, constants: [], dataSources: [], elements: [], folder }}
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
