import { useEffect, useRef } from 'react';

import { NavModel } from '@grafana/data';
import { Branding } from 'app/core/components/Branding/Branding';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { safeParseJson } from 'app/core/utils/explore';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ExploreQueryParams } from 'app/types';

export function useExplorePageTitle(params: ExploreQueryParams) {
  const navModel = useRef<NavModel>();
  navModel.current = useNavModel('explore');
  const dsService = useRef(getDatasourceSrv());

  useEffect(() => {
    if (!params.panes || params.panes !== 'string') {
      return;
    }

    Promise.all(
      Object.values(safeParseJson(params.panes)).map((pane) => {
        if (!pane || typeof pane !== 'object' || !hasKey('datasource', pane) || typeof pane.datasource !== 'string') {
          return Promise.reject();
        }

        return dsService.current.get(pane.datasource);
      })
    ).then((datasources) => {
      if (!navModel.current) {
        return;
      }

      const names = datasources.map((ds) => ds.name);

      if (names.length === 0) {
        document.title = `${navModel.current.main.text} - ${Branding.AppTitle}`;
        return;
      }

      document.title = `${navModel.current.main.text} - ${names.join(' | ')} - ${Branding.AppTitle}`;
    });
  }, [params.panes]);
}

// TS<5 does not support `in` operator for type narrowing. once we upgrade to TS5, we can remove this function and just use the in operator instead.
function hasKey<K extends string, T extends object>(k: K, o: T): o is T & Record<K, unknown> {
  return k in o;
}
