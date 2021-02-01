import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { AppEvents, locationUtil } from '@grafana/data';
import { useDispatch, useSelector } from 'react-redux';
import { SaveDashboardOptions } from './types';
import { CoreEvents, StoreState } from 'app/types';
import appEvents from 'app/core/app_events';
import { updateLocation } from 'app/core/reducers/location';
import { DashboardModel } from 'app/features/dashboard/state';
import { saveDashboard as saveDashboardApiCall } from 'app/features/manage-dashboards/state/actions';
import { getBackendSrv } from 'app/core/services/backend_srv';
import config from 'app/core/config';

const saveLibraryPanels = (saveModel: any, folderId: number) => {
  // Check if there are any new library panels that need to be created first
  const panelPromises = [];
  for (const [i, panel] of saveModel.panels.entries()) {
    if (!panel.libraryPanel) {
      continue;
    } else if (panel.libraryPanel && panel.libraryPanel.uid === undefined) {
      panel.libraryPanel.name = panel.title;
      panelPromises.push(
        getBackendSrv()
          .addLibraryPanel(panel, folderId!)
          .then((returnedPanel) => {
            saveModel.panels[i] = {
              id: returnedPanel.model.id,
              gridPos: returnedPanel.model.gridPos,
              libraryPanel: {
                uid: returnedPanel.uid,
                name: returnedPanel.name,
              },
            };
          })
      );
    } else {
      // For now, update library panels. Implement "Update panel instances" modal later.
      panelPromises.push(
        getBackendSrv()
          .updateLibraryPanel(panel, folderId!)
          .then((returnedPanel) => {
            saveModel.panels[i] = {
              id: returnedPanel.model.id,
              gridPos: returnedPanel.model.gridPos,
              libraryPanel: {
                uid: returnedPanel.uid,
                name: returnedPanel.name,
              },
            };
          })
      );
    }
  }

  return Promise.all(panelPromises).then(() => saveModel);
};

const saveDashboard = async (saveModel: any, options: SaveDashboardOptions, dashboard: DashboardModel) => {
  let folderId = options.folderId;
  if (folderId === undefined) {
    folderId = dashboard.meta.folderId ?? saveModel.folderId;
  }

  if (config.featureToggles.panelLibrary) {
    await saveLibraryPanels(saveModel, folderId!);
  }

  return await saveDashboardApiCall({ ...options, folderId, dashboard: saveModel });
};

export const useDashboardSave = (dashboard: DashboardModel) => {
  const location = useSelector((state: StoreState) => state.location);
  const dispatch = useDispatch();
  const [state, onDashboardSave] = useAsyncFn(
    async (clone: any, options: SaveDashboardOptions, dashboard: DashboardModel) =>
      await saveDashboard(clone, options, dashboard),
    []
  );

  useEffect(() => {
    if (state.value) {
      dashboard.version = state.value.version;

      // important that these happen before location redirect below
      appEvents.emit(CoreEvents.dashboardSaved, dashboard);
      appEvents.emit(AppEvents.alertSuccess, ['Dashboard saved']);

      const newUrl = locationUtil.stripBaseFromUrl(state.value.url);
      const currentPath = location.path;

      if (newUrl !== currentPath) {
        dispatch(
          updateLocation({
            path: newUrl,
            replace: true,
            query: {},
          })
        );
      }
    }
  }, [state]);

  return { state, onDashboardSave };
};
