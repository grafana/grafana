import { useEffect } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { Branding } from 'app/core/components/Branding/Branding';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { ExploreQueryParams } from 'app/types/explore';

import { isFulfilled, hasKey } from './utils';

export function useExplorePageTitle(params: ExploreQueryParams) {
  const navModel = useNavModel('explore');
  const { chrome } = useGrafana();

  useEffect(() => {
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

        return getDataSourceSrv().get(pane.datasource);
      })
    )
      .then((results) => results.filter(isFulfilled).map((result) => result.value))
      .then((datasources) => {
        if (datasources.length === 0) {
          global.document.title = `${navModel.main.text} - ${Branding.AppTitle}`;
          chrome.update({
            pageNav: undefined,
          });
          return;
        }

        const namesString = datasources.map((ds) => ds.name).join(' | ');
        chrome.update({
          pageNav: {
            text: namesString,
          },
        });
        global.document.title = `${navModel.main.text} - ${namesString} - ${Branding.AppTitle}`;
      });
  }, [params.panes, navModel.main.text, chrome]);
}
