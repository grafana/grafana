import { within } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import { fromPairs } from 'lodash';
import React from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';

import { DataSourceApi, DataSourceInstanceSettings, DataSourceRef, QueryEditorProps, ScopedVars } from '@grafana/data';
import { locationService, setDataSourceSrv, setEchoSrv } from '@grafana/runtime';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { Echo } from 'app/core/services/echo/Echo';
import { configureStore } from 'app/store/configureStore';

import { RICH_HISTORY_KEY, RichHistoryLocalStorageDTO } from '../../../../core/history/RichHistoryLocalStorage';
import { RICH_HISTORY_SETTING_KEYS } from '../../../../core/history/richHistoryLocalStorageUtils';
import { LokiDatasource } from '../../../../plugins/datasource/loki/datasource';
import { LokiQuery } from '../../../../plugins/datasource/loki/types';
import { ExploreId } from '../../../../types';
import { initialUserState } from '../../../profile/state/reducers';
import Wrapper from '../../Wrapper';

type DatasourceSetup = { settings: DataSourceInstanceSettings; api: DataSourceApi };

type SetupOptions = {
  // default true
  clearLocalStorage?: boolean;
  datasources?: DatasourceSetup[];
  urlParams?: { left: string; right?: string };
  searchParams?: string;
};

export function setupExplore(options?: SetupOptions): {
  datasources: { [name: string]: DataSourceApi };
  store: ReturnType<typeof configureStore>;
  unmount: () => void;
  container: HTMLElement;
} {
  // Clear this up otherwise it persists data source selection
  // TODO: probably add test for that too
  if (options?.clearLocalStorage !== false) {
    window.localStorage.clear();
  }

  // Create this here so any mocks are recreated on setup and don't retain state
  const defaultDatasources: DatasourceSetup[] = [
    makeDatasourceSetup(),
    makeDatasourceSetup({ name: 'elastic', id: 2 }),
  ];

  const dsSettings = options?.datasources || defaultDatasources;

  setDataSourceSrv({
    getList(): DataSourceInstanceSettings[] {
      return dsSettings.map((d) => d.settings);
    },
    getInstanceSettings(ref: DataSourceRef) {
      return dsSettings.map((d) => d.settings).find((x) => x.name === ref || x.uid === ref || x.uid === ref.uid);
    },
    get(name?: string | null, scopedVars?: ScopedVars): Promise<DataSourceApi> {
      return Promise.resolve(
        (name ? dsSettings.find((d) => d.api.name === name || d.api.uid === name) : dsSettings[0])!.api
      );
    },
  } as any);

  setEchoSrv(new Echo());

  const store = configureStore();
  store.getState().user = {
    ...initialUserState,
    orgId: 1,
    timeZone: 'utc',
  };

  store.getState().navIndex = {
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
    locationService.partial(options.urlParams);
  }

  const route = { component: Wrapper };

  const { unmount, container } = render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <Route path="/explore" exact render={(props) => <GrafanaRoute {...props} route={route as any} />} />
      </Router>
    </Provider>
  );

  return { datasources: fromPairs(dsSettings.map((d) => [d.api.name, d.api])), store, unmount, container };
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
      uid: name,
      type: 'logs',
      name,
      meta,
      access: 'proxy',
      jsonData: {},
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
      uid: name,
      query: jest.fn(),
      getRef: jest.fn().mockReturnValue(name),
      meta,
    } as any,
  };
}

export const waitForExplore = async (exploreId: ExploreId = ExploreId.left) => {
  return await withinExplore(exploreId).findByText(/Editor/i);
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
  window.localStorage.setItem(
    RICH_HISTORY_KEY,
    JSON.stringify([
      {
        ts: Date.now(),
        datasourceName: dsName,
        starred: true,
        comment: '',
        queries: [{ refId: 'A' }],
      } as RichHistoryLocalStorageDTO,
    ])
  );
};
