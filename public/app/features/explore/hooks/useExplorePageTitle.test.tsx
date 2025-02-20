import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { setDataSourceSrv } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';

import { makeDatasourceSetup } from '../spec/helper/setup';

import { useExplorePageTitle } from './useExplorePageTitle';

describe('useExplorePageTitle', () => {
  it('changes the document title of the explore page to include the datasource in use', async () => {
    const datasources = [
      makeDatasourceSetup({ name: 'loki', uid: 'loki-uid' }),
      makeDatasourceSetup({ name: 'elastic', uid: 'elastic-uid' }),
    ];

    setDataSourceSrv({
      registerRuntimeDataSource: jest.fn(),
      get(datasource?: string | DataSourceRef | null) {
        let ds;
        if (!datasource) {
          ds = datasources[0]?.api;
        } else {
          ds = datasources.find((ds) =>
            typeof datasource === 'string'
              ? ds.api.name === datasource || ds.api.uid === datasource
              : ds.api.uid === datasource?.uid
          )?.api;
        }

        if (ds) {
          return Promise.resolve(ds);
        }

        return Promise.reject();
      },
      getInstanceSettings: jest.fn(),
      getList: jest.fn(),
      reload: jest.fn(),
    });

    const chromeMock: AppChromeService = jest.mocked(new AppChromeService());
    chromeMock.update = jest.fn();

    renderHook(() => useExplorePageTitle({ panes: JSON.stringify({ a: { datasource: 'loki-uid' } }) }), {
      wrapper: ({ children }) => (
        <TestProvider
          grafanaContext={{
            ...getGrafanaContextMock(),
            chrome: chromeMock,
          }}
        >
          {children}
        </TestProvider>
      ),
    });

    await waitFor(() => {
      expect(global.document.title).toEqual(expect.stringContaining('loki'));
      expect(global.document.title).toEqual(expect.not.stringContaining('elastic'));
      // checks if the breadcrumb is updated with the datasource name
      expect(chromeMock.update).toHaveBeenCalledWith({ pageNav: { text: 'loki' } });
    });
  });

  it('changes the document title to include the two datasources in use in split view mode', async () => {
    const datasources = [
      makeDatasourceSetup({ name: 'loki', uid: 'loki-uid' }),
      makeDatasourceSetup({ name: 'elastic', uid: 'elastic-uid' }),
    ];

    setDataSourceSrv({
      registerRuntimeDataSource: jest.fn(),
      get(datasource?: string | DataSourceRef | null) {
        let ds;
        if (!datasource) {
          ds = datasources[0]?.api;
        } else {
          ds = datasources.find((ds) =>
            typeof datasource === 'string'
              ? ds.api.name === datasource || ds.api.uid === datasource
              : ds.api.uid === datasource?.uid
          )?.api;
        }

        if (ds) {
          return Promise.resolve(ds);
        }

        return Promise.reject();
      },
      getInstanceSettings: jest.fn(),
      getList: jest.fn(),
      reload: jest.fn(),
    });

    const chromeMock: AppChromeService = jest.mocked(new AppChromeService());
    chromeMock.update = jest.fn();

    renderHook(
      () =>
        useExplorePageTitle({
          panes: JSON.stringify({ a: { datasource: 'loki-uid' }, b: { datasource: 'elastic-uid' } }),
        }),
      {
        wrapper: ({ children }) => (
          <TestProvider
            grafanaContext={{
              ...getGrafanaContextMock(),
              chrome: chromeMock,
            }}
          >
            {children}
          </TestProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(global.document.title).toEqual(expect.stringContaining('loki | elastic'));
      // checks if the breadcrumb is updated with the datasource name
      expect(chromeMock.update).toHaveBeenCalledWith({ pageNav: { text: 'loki | elastic' } });
    });
  });
});
