import { useEffect, useState } from 'react';

// @todo: replace barrel import path
import { DashboardModel } from 'app/features/dashboard/state/index';

import { getUnsupportedDashboardDatasources } from './SharePublicDashboardUtils';

export const useGetUnsupportedDataSources = (dashboard: DashboardModel) => {
  const [unsupportedDataSources, setUnsupportedDataSources] = useState<string[]>([]);

  useEffect(() => {
    const fetchUnsupportedDataSources = async () => {
      return await getUnsupportedDashboardDatasources(dashboard.panels);
    };

    fetchUnsupportedDataSources().then((dsList) => {
      setUnsupportedDataSources(dsList);
    });
  }, [dashboard.panels]);

  return { unsupportedDataSources };
};
