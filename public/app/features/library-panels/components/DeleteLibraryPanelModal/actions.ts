import { DispatchResult, LibraryPanelDTO } from '../../types';
import { getConnectedDashboards as apiGetConnectedDashboards } from '../../state/api';
import { searchCompleted } from './reducer';

export function getConnectedDashboards(libraryPanel: LibraryPanelDTO): DispatchResult {
  return async function (dispatch) {
    const dashboards = await apiGetConnectedDashboards(libraryPanel.uid);
    dispatch(searchCompleted({ dashboards }));
  };
}
