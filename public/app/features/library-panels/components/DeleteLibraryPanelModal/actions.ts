import { DispatchResult, LibraryPanelDTO } from '../../types';
import { getLibraryPanelConnectedDashboards } from '../../state/api';
import { getBackendSrv } from '../../../../core/services/backend_srv';
import { searchCompleted } from './reducer';

export function getConnectedDashboards(libraryPanel: LibraryPanelDTO): DispatchResult {
  return async function (dispatch) {
    const connectedDashboards = await getLibraryPanelConnectedDashboards(libraryPanel.uid);
    if (!connectedDashboards.length) {
      dispatch(searchCompleted({ dashboards: [] }));
      return;
    }

    const dashboards = await getBackendSrv().search({ dashboardIds: connectedDashboards });
    dispatch(searchCompleted({ dashboards }));
  };
}
