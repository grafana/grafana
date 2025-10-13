import memoizeOne from 'memoize-one';

import { DashboardDTO } from '../../../../../types';
import { DashboardModel } from '../../../../dashboard/state/DashboardModel';
import { dashboardApi } from '../../api/dashboardApi';

const convertToDashboardModel = memoizeOne((dashboardDTO: DashboardDTO) => {
  // RTKQuery freezes all returned objects. DashboardModel constructor runs migrations which might change the internal object
  // Hence we need to add structuredClone to make a deep copy of the API response object
  const { dashboard, meta } = structuredClone(dashboardDTO);
  return new DashboardModel(dashboard, meta);
});

export function useDashboardQuery(dashboardUid?: string) {
  const queryData = dashboardApi.endpoints.dashboard.useQuery(
    { uid: dashboardUid ?? '' },
    {
      skip: !dashboardUid,
      selectFromResult: ({ currentData, data, ...rest }) => ({
        dashboardModel: currentData ? convertToDashboardModel(currentData) : undefined,
        ...rest,
      }),
    }
  );

  return queryData;
}
