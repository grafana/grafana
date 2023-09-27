import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { setDataSourceSrv } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';

import { makeDatasourceSetup } from '../spec/helper/setup';

import { useExplorePageTitle } from './useExplorePageTitle';

describe('useExplorePageTitle', () => {
  it('changes the document title of the explore page to include the datasource in use', async () => {
    const datasources = [
      makeDatasourceSetup({ name: 'loki', uid: 'loki-uid' }),
      makeDatasourceSetup({ name: 'elastic', uid: 'elastic-uid' }),
    ];

    setDataSourceSrv({
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

    renderHook(() => useExplorePageTitle({ panes: JSON.stringify({ a: { datasource: 'loki-uid' } }) }), {
      wrapper: TestProvider,
    });

    await waitFor(() => {
      expect(global.document.title).toEqual(expect.stringContaining('loki'));
      expect(global.document.title).toEqual(expect.not.stringContaining('elastic'));
    });
  });

  it('changes the document title to include the two datasources in use in split view mode', async () => {
    const datasources = [
      makeDatasourceSetup({ name: 'loki', uid: 'loki-uid' }),
      makeDatasourceSetup({ name: 'elastic', uid: 'elastic-uid' }),
    ];

    setDataSourceSrv({
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

    renderHook(
      () =>
        useExplorePageTitle({
          panes: JSON.stringify({ a: { datasource: 'loki-uid' }, b: { datasource: 'elastic-uid' } }),
        }),
      {
        wrapper: TestProvider,
      }
    );

    await waitFor(() => {
      expect(global.document.title).toEqual(expect.stringContaining('loki | elastic'));
    });
  });
});
