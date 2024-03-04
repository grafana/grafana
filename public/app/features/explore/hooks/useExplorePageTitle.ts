import { useEffect, useRef } from 'react';

import { NavModel } from '@grafana/data';
import { Branding } from 'app/core/components/Branding/Branding';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ExploreQueryParams } from 'app/types';

import { ExploreWorkspace, ExploreWorkspaceSnapshot } from '../workspaces/types';

import { isFulfilled, hasKey } from './utils';

export function useExplorePageTitle(
  params: ExploreQueryParams,
  workspace?: ExploreWorkspace,
  snapshot?: ExploreWorkspaceSnapshot
) {
  const navModel = useRef<NavModel>();
  navModel.current = useNavModel('explore');
  const dsService = useRef(getDatasourceSrv());

  useEffect(() => {
    if (snapshot && workspace) {
      global.document.title = '📷 ' + snapshot.name + ' (' + workspace.name + ')';
      return;
    }

    if (workspace) {
      global.document.title = workspace.name;
      return;
    }

    if (!params.panes || typeof params.panes !== 'string') {
      return;
    }

    let panesObject: unknown;
    try {
      panesObject = JSON.parse(params.panes);
    } catch {
      return;
    }

    if (typeof panesObject !== 'object' || panesObject === null) {
      return;
    }

    Promise.allSettled(
      Object.values(panesObject).map((pane) => {
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
  }, [params.panes, workspace, snapshot]);
}
