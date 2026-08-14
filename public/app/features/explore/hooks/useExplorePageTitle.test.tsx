import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';

import { makeDatasourceSetup } from '../spec/helper/setup';

import { useExplorePageTitle } from './useExplorePageTitle';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

const getDataSourceInstanceMock = jest.mocked(getDataSourceInstance);

afterEach(() => {
  getDataSourceInstanceMock.mockReset();
});

describe('useExplorePageTitle', () => {
  it('changes the document title of the explore page to include the datasource in use', async () => {
    const datasources = [
      makeDatasourceSetup({ name: 'loki', uid: 'loki-uid' }),
      makeDatasourceSetup({ name: 'elastic', uid: 'elastic-uid' }),
    ];

    getDataSourceInstanceMock.mockImplementation(async (datasource) => {
      const ds =
        typeof datasource === 'string'
          ? datasources.find((ds) => ds.api.name === datasource || ds.api.uid === datasource)?.api
          : datasources.find((ds) => ds.api.uid === datasource?.uid)?.api;

      if (ds) {
        return ds;
      }

      throw new Error(`Datasource ${datasource} not found`);
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

    getDataSourceInstanceMock.mockImplementation(async (datasource) => {
      const ds =
        typeof datasource === 'string'
          ? datasources.find((ds) => ds.api.name === datasource || ds.api.uid === datasource)?.api
          : datasources.find((ds) => ds.api.uid === datasource?.uid)?.api;

      if (ds) {
        return ds;
      }

      throw new Error(`Datasource ${datasource} not found`);
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
