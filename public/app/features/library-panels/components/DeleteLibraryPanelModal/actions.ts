import { getConnectedDashboards as apiGetConnectedDashboards } from '../../state/api';
import { DispatchResult, LibraryElementDTO } from '../../types';

import { searchCompleted } from './reducer';

export function getConnectedDashboards(libraryPanel: LibraryElementDTO): DispatchResult {
  return async function (dispatch) {
    const dashboards = await apiGetConnectedDashboards(libraryPanel.uid);
    dispatch(searchCompleted({ dashboards }));
  };
}
