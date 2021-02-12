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
import { getLibrarySrv } from 'app/core/services/library_srv';

// Putting this here purely as a temporary measure, but I suspect it would make more sense
// to handle panel unlinking on the backend in a similar manner.
const unlinkLibraryPanels = (dashboard: DashboardModel) => {
  const libraryPanels = dashboard.panels
    .filter((panel) => panel.libraryPanel?.uid !== undefined)
    .reduce<Record<string, boolean>>((libPanels, curPanel) => {
      libPanels[curPanel.libraryPanel!.uid!] = true;
      return libPanels;
    }, {});

  const panelsToUnlink = dashboard.originalLibraryPanels.filter((libPanelId) => !libraryPanels[libPanelId]);
  return panelsToUnlink.map((panelId) => getLibrarySrv().disconnectLibraryPanel(panelId, dashboard.id));
};

const saveDashboard = async (saveModel: any, options: SaveDashboardOptions, dashboard: DashboardModel) => {
  let folderId = options.folderId;
  if (folderId === undefined) {
    folderId = dashboard.meta.folderId ?? saveModel.folderId;
  }

  const savePromise = Promise.all([
    saveDashboardApiCall({ ...options, folderId, dashboard: saveModel }),
    ...unlinkLibraryPanels(dashboard),
  ]);
  return (await savePromise)[0];
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
