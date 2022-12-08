import { toLower } from 'lodash';
import { useMemo } from 'react';

import { NavModelItem, UrlQueryValue } from '@grafana/data';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

export const tabIds = {
  overview: 'overview',
  status: 'status',
};

type TabsResult = {
  tabId: string;
  tabs: NavModelItem[];
};

export function usePluginRecipeDetailsPageTabs(): TabsResult {
  const [query, setQueryParams] = useQueryParams();
  const current = parseTabId(query.page);

  return useMemo((): TabsResult => {
    return {
      tabId: current,
      tabs: [
        {
          id: tabIds.overview,
          text: 'Overview',
          onClick: () => setQueryParams({ page: tabIds.overview }),
          active: current === tabIds.overview,
        },
        {
          id: tabIds.status,
          text: 'Status',
          onClick: () => setQueryParams({ page: tabIds.status }),
          active: current === tabIds.status,
        },
      ],
    };
  }, [current, setQueryParams]);
}

function parseTabId(raw: UrlQueryValue): string {
  const tabId = Object.values(tabIds).find((id) => {
    return id === toLower(String(raw));
  });
  return tabId ?? tabIds.overview;
}
