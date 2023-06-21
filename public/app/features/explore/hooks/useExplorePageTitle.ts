import { useEffect, useRef } from 'react';

import { NavModel } from '@grafana/data';
import { Branding } from 'app/core/components/Branding/Branding';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { safeParseJson } from 'app/core/utils/explore';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ExploreQueryParams } from 'app/types';

import { isFulfilled, hasKey } from './utils';

export function useExplorePageTitle(params: ExploreQueryParams) {
  const navModel = useRef<NavModel>();
  navModel.current = useNavModel('explore');
  const dsService = useRef(getDatasourceSrv());

  useEffect(() => {
    if (!params.panes || typeof params.panes !== 'string') {
      return;
    }

    Promise.allSettled(
      Object.values(safeParseJson(params.panes)).map((pane) => {
        if (
          !pane ||
          typeof pane !== 'object' ||
          !hasKey('datasource', pane) ||
          !pane.datasource ||
          typeof pane.datasource !== 'string'
        ) {
          return Promise.reject();
        }

        return dsService.current.get(pane.datasource);
      })
    )
      .then((results) => results.filter(isFulfilled).map((result) => result.value))
      .then((datasources) => {
        if (!navModel.current) {
          return;
        }

        const names = datasources.map((ds) => ds.name);

        if (names.length === 0) {
          global.document.title = `${navModel.current.main.text} - ${Branding.AppTitle}`;
          return;
        }

        global.document.title = `${navModel.current.main.text} - ${names.join(' | ')} - ${Branding.AppTitle}`;
      });
  }, [params.panes]);
}
