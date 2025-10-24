import memoizeOne from 'memoize-one';
import { useEffect, useState } from 'react';

import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardDTO } from 'app/types/dashboard';

import { DashboardModel } from '../../../../dashboard/state/DashboardModel';

const convertToDashboardModel = memoizeOne((dashboardDTO: DashboardDTO) => {
  // RTKQuery freezes all returned objects. DashboardModel constructor runs migrations which might change the internal object
  // Hence we need to add structuredClone to make a deep copy of the API response object
  const { dashboard, meta } = structuredClone(dashboardDTO);
  return new DashboardModel(dashboard, meta);
});

export function useDashboardQuery(dashboardUid?: string) {
  const [dashboardModel, setDashboardModel] = useState<DashboardModel>();
  const [isFetching, setIsFetching] = useState(false);
  useEffect(() => {
    if (dashboardUid) {
      setIsFetching(true);
      getDashboardAPI()
        .getDashboardDTO(dashboardUid)
        .then((dashboard) => {
          if (!('dashboard' in dashboard)) {
            console.error('Something went wrong, unexpected dashboard format');
          } else {
            setDashboardModel(convertToDashboardModel(dashboard));
          }
          setIsFetching(false);
        });
    }
  }, [dashboardUid]);

  return { dashboardModel, isFetching };
}
