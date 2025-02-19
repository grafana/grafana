import { useEffect, useState } from 'react';

import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

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
