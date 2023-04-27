import { render, screen, within } from '@testing-library/react';
import { fromPairs } from 'lodash';
import React from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import {
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceRef,
  QueryEditorProps,
  ScopedVars,
  UrlQueryValue,
} from '@grafana/data';
import { locationSearchToObject, locationService, setDataSourceSrv, setEchoSrv, config } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { Echo } from 'app/core/services/echo/Echo';
import store from 'app/core/store';
import { lastUsedDatasourceKeyForOrgId } from 'app/core/utils/explore';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { configureStore } from 'app/store/configureStore';

import { RICH_HISTORY_KEY, RichHistoryLocalStorageDTO } from '../../../../core/history/RichHistoryLocalStorage';
import { RICH_HISTORY_SETTING_KEYS } from '../../../../core/history/richHistoryLocalStorageUtils';
import { LokiDatasource } from '../../../../plugins/datasource/loki/datasource';
import { LokiQuery } from '../../../../plugins/datasource/loki/types';
import { ExploreId } from '../../../../types';
import { initialUserState } from '../../../profile/state/reducers';
import { ExplorePage } from '../../ExplorePage';

type DatasourceSetup = { settings: DataSourceInstanceSettings; api: DataSourceApi };

type SetupOptions = {
  // default true
  clearLocalStorage?: boolean;
  datasources?: DatasourceSetup[];
  urlParams?: { left: string; right?: string } | string;
  searchParams?: string;
  prevUsedDatasource?: { orgId: number; datasource: string };
};

export function setupExplore(options?: SetupOptions): {
  datasources: { [uid: string]: DataSourceApi };
  store: ReturnType<typeof configureStore>;
  unmount: () => void;
  container: HTMLElement;
} {
  // Clear this up otherwise it persists data source selection
  // TODO: probably add test for that too
  if (options?.clearLocalStorage !== false) {
    window.localStorage.clear();
  }

  if (options?.prevUsedDatasource) {
    store.set(lastUsedDatasourceKeyForOrgId(options?.prevUsedDatasource.orgId), options?.prevUsedDatasource.datasource);
  }

  // Create this here so any mocks are recreated on setup and don't retain state
  const defaultDatasources: DatasourceSetup[] = [
    makeDatasourceSetup(),
    makeDatasourceSetup({ name: 'elastic', id: 2 }),
  ];

  if (config.featureToggles.exploreMixedDatasource) {
    defaultDatasources.push(makeDatasourceSetup({ name: MIXED_DATASOURCE_NAME, id: 999 }));
  }

  const dsSettings = options?.datasources || defaultDatasources;

  setDataSourceSrv({
    getList(): DataSourceInstanceSettings[] {
      return dsSettings.map((d) => d.settings);
    },
    getInstanceSettings(ref: DataSourceRef) {
      return dsSettings.map((d) => d.settings).find((x) => x.name === ref || x.uid === ref || x.uid === ref.uid);
    },
    get(datasource?: string | DataSourceRef | null, scopedVars?: ScopedVars): Promise<DataSourceApi | undefined> {
      if (dsSettings.length === 0) {
        return Promise.resolve(undefined);
      } else {
        const datasourceStr = typeof datasource === 'string';
        return Promise.resolve(
          (datasource
            ? dsSettings.find((d) =>
                datasourceStr ? d.api.name === datasource || d.api.uid === datasource : d.api.uid === datasource?.uid
              )
            : dsSettings[0])!.api
        );
      }
    },
  } as any);

  setEchoSrv(new Echo());

  const storeState = configureStore();
  storeState.getState().user = {
    ...initialUserState,
    orgId: 1,
    timeZone: 'utc',
  };

  storeState.getState().navIndex = {
    explore: {
      id: 'explore',
      text: 'Explore',
      subTitle: 'Explore your data',
      icon: 'compass',
      url: '/explore',
    },
  };

  locationService.push({ pathname: '/explore', search: options?.searchParams });

  if (options?.urlParams) {
    let urlParams: Record<string, string | UrlQueryValue> =
      typeof options.urlParams === 'string' ? locationSearchToObject(options.urlParams) : options.urlParams;
    locationService.partial(urlParams);
  }

  const route = { component: ExplorePage };

  const { unmount, container } = render(
    <Provider store={storeState}>
      <GrafanaContext.Provider value={getGrafanaContextMock()}>
        <Router history={locationService.getHistory()}>
          <Route path="/explore" exact render={(props) => <GrafanaRoute {...props} route={route as any} />} />
        </Router>
      </GrafanaContext.Provider>
    </Provider>
  );

  return { datasources: fromPairs(dsSettings.map((d) => [d.api.name, d.api])), store: storeState, unmount, container };
}

function makeDatasourceSetup({ name = 'loki', id = 1 }: { name?: string; id?: number } = {}): DatasourceSetup {
  const meta: any = {
    info: {
      logos: {
        small: '',
      },
    },
    id: id.toString(),
  };
  return {
    settings: {
      id,
      uid: `${name}-uid`,
      type: 'logs',
      name,
      meta,
      access: 'proxy',
      jsonData: {},
      readOnly: false,
    },
    api: {
      components: {
        QueryEditor(props: QueryEditorProps<LokiDatasource, LokiQuery>) {
          return (
            <div>
              <input
                aria-label="query"
                defaultValue={props.query.expr}
                onChange={(event) => {
                  props.onChange({ ...props.query, expr: event.target.value });
                }}
              />
              {name} Editor input: {props.query.expr}
            </div>
          );
        },
      },
      name: name,
      uid: `${name}-uid`,
      query: jest.fn(),
      getRef: jest.fn().mockReturnValue({ type: 'logs', uid: `${name}-uid` }),
      meta,
    } as any,
  };
}

export const waitForExplore = async (exploreId: ExploreId = ExploreId.left, multi = false) => {
  if (multi) {
    return await withinExplore(exploreId).findAllByText(/Editor/i);
  } else {
    return await withinExplore(exploreId).findByText(/Editor/i);
  }
};

export const tearDown = () => {
  window.localStorage.clear();
};

export const withinExplore = (exploreId: ExploreId) => {
  const container = screen.getAllByTestId('data-testid Explore');
  return within(container[exploreId === ExploreId.left ? 0 : 1]);
};

export const localStorageHasAlreadyBeenMigrated = () => {
  window.localStorage.setItem(RICH_HISTORY_SETTING_KEYS.migrated, 'true');
};

export const setupLocalStorageRichHistory = (dsName: string) => {
  const richHistoryDTO: RichHistoryLocalStorageDTO = {
    ts: Date.now(),
    datasourceName: dsName,
    starred: true,
    comment: '',
    queries: [{ refId: 'A' }],
  };
  window.localStorage.setItem(RICH_HISTORY_KEY, JSON.stringify([richHistoryDTO]));
};
