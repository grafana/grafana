import { useEffect, useState } from 'react';

import impressionSrv from 'app/core/services/impression_srv';

import { getDashboardAPI } from '../dashboard/api/dashboard_api';
import { getGrafanaSearcher } from '../search/service';

import { CommandPaletteResultItem } from './types';

const MAX_RECENT_DASHBOARDS = 10;

export function useRecentDashboards() {
  const [items, setItems] = useState<CommandPaletteResultItem[]>([]);

  useEffect(() => {
    (async () => {
      const recentUids = (await impressionSrv.getDashboardOpened()).slice(0, MAX_RECENT_DASHBOARDS);
      const resultsDataFrame = await getGrafanaSearcher().search({
        kind: ['dashboard'],
        limit: MAX_RECENT_DASHBOARDS,
        uid: recentUids,
      });

      const recentResults = resultsDataFrame.view.toArray().map((v) => {
        const item: CommandPaletteResultItem = {
          type: 'result',
          title: v.name,
          icon: 'apps',
          uid: v.uid,
        };

        return item;
      });

      for (const recentDash of recentResults) {
        getDashboardAPI()
          .getDashboardDTO(recentDash.uid ?? 'fallback lol')
          .then((fullDash) => {
            setItems((prevItems) => {
              return prevItems.map((item) => {
                if (item.uid === fullDash.dashboard.uid) {
                  return { ...item, parentTitle: fullDash.meta.folderTitle, parentIcon: 'folder-open' };
                }

                return item;
              });
            });
          });
      }

      setItems(recentResults);
    })();
  }, []);

  return items;
}
