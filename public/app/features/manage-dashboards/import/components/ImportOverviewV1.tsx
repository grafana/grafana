import { useState } from 'react';

import { AppEvents, locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { appEvents } from 'app/core/app_events';
import { Form } from 'app/core/components/Form/Form';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { addLibraryPanel } from 'app/features/library-panels/state/api';

import { DashboardInputs, DashboardSource, ImportDashboardDTO, LibraryPanelInputState } from '../../types';
import { applyV1DatasourceInputs } from '../utils/transform';

import { GcomDashboardInfo } from './GcomDashboardInfo';
import { ImportForm } from './ImportForm';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

type Props = {
  dashboard: Dashboard;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  folderUid: string;
  onCancel: () => void;
};

export function ImportOverviewV1({ dashboard, inputs, meta, source, folderUid, onCancel }: Props) {
  const [uidReset, setUidReset] = useState(false);
  const folder = { uid: folderUid };

  async function onSubmit(form: ImportDashboardDTO) {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    try {
      const dashboardWithDataSources = applyV1DatasourceInputs(dashboard, inputs, form);

      // Import new library panels first
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

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={dashboard.gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <Form
        onSubmit={onSubmit}
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
            onSubmit={onSubmit}
            watch={watch}
          />
        )}
      </Form>
    </>
  );
}
