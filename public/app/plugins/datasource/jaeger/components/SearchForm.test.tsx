import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { DataQueryRequest, DataSourceInstanceSettings, dateTime, PluginMetaInfo, PluginType } from '@grafana/data';
import { BackendSrv } from '@grafana/runtime';

import { JaegerDatasource, JaegerJsonData } from '../datasource';
import { createFetchResponse } from '../helpers/createFetchResponse';
import { testResponse } from '../testResponse';
import { JaegerQuery } from '../types';

import SearchForm from './SearchForm';

export const backendSrv = { fetch: jest.fn() } as unknown as BackendSrv;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: jest.fn(),
    containsTemplate: (val: string): boolean => {
      return val.includes('$');
    },
  }),
}));

describe('SearchForm', () => {
  it('should call the `onChange` function on click of the Input', async () => {
    const promise = Promise.resolve();
    const handleOnChange = jest.fn(() => promise);
    const query = {
      ...defaultQuery,
      refId: '121314',
    };
    const ds = {
      async metadataRequest(url) {
        if (url === '/api/services') {
          return Promise.resolve(['jaeger-query', 'service2', 'service3']);
        }
        return undefined;
      },
    } as JaegerDatasource;
    setupFetchMock({ data: [testResponse] });

    render(<SearchForm datasource={ds} query={query} onChange={handleOnChange} />);

    const asyncServiceSelect = await waitFor(() => screen.getByRole('combobox', { name: 'select-service-name' }));
    expect(asyncServiceSelect).toBeInTheDocument();

    await userEvent.click(asyncServiceSelect);

    const jaegerService = await screen.findByText('jaeger-query');
    expect(jaegerService).toBeInTheDocument();
  });

  it('should be able to select operation name if query.service exists', async () => {
    const promise = Promise.resolve();
    const handleOnChange = jest.fn(() => promise);
    const query2 = {
      ...defaultQuery,
      refId: '121314',
      service: 'jaeger-query',
    };
    setupFetchMock({ data: [testResponse] });

    render(<SearchForm datasource={{} as JaegerDatasource} query={query2} onChange={handleOnChange} />);

    const asyncOperationSelect2 = await waitFor(() => screen.getByRole('combobox', { name: 'select-operation-name' }));
    expect(asyncOperationSelect2).toBeInTheDocument();
  });
});

describe('SearchForm', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let query: JaegerQuery;
  let ds: JaegerDatasource;

  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });

    query = {
      ...defaultQuery,
      refId: '121314',
      service: 'jaeger-query',
    };

    ds = new JaegerDatasource(defaultSettings);
    setupFetchMock({ data: [testResponse] });

    jest.spyOn(ds, 'metadataRequest').mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(['jaeger-query']);
        }, 3000);
      });
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show loader if there is a delay fetching options', async () => {
    const handleOnChange = jest.fn();
    render(<SearchForm datasource={ds} query={query} onChange={handleOnChange} />);

    const asyncServiceSelect = screen.getByRole('combobox', { name: 'select-service-name' });
    await user.click(asyncServiceSelect);
    expect(screen.getByText('Loading options...')).toBeInTheDocument();

    jest.advanceTimersByTime(3000);
    await waitFor(() => expect(screen.queryByText('Loading options...')).not.toBeInTheDocument());
  });

  it('should filter the span dropdown when user types a search value', async () => {
    render(<SearchForm datasource={ds} query={query} onChange={() => {}} />);

    const asyncServiceSelect = screen.getByRole('combobox', { name: 'select-service-name' });
    expect(asyncServiceSelect).toBeInTheDocument();
    await user.click(asyncServiceSelect);
    jest.advanceTimersByTime(3000);

    await user.type(asyncServiceSelect, 'j');
    let option = await screen.findByText('jaeger-query');
    expect(option).toBeDefined();

    await user.type(asyncServiceSelect, 'c');
    option = await screen.findByText('Hit enter to add');
    expect(option).toBeDefined();
  });

  it('should add variable to select menu options', async () => {
    query = {
      ...defaultQuery,
      refId: '121314',
      service: '$service',
      operation: '$operation',
    };

    render(<SearchForm datasource={ds} query={query} onChange={() => {}} />);

    const asyncServiceSelect = screen.getByRole('combobox', { name: 'select-service-name' });
    expect(asyncServiceSelect).toBeInTheDocument();
    await user.click(asyncServiceSelect);
    jest.advanceTimersByTime(3000);

    await user.type(asyncServiceSelect, '$');
    const serviceOption = await screen.findByText('$service');
    expect(serviceOption).toBeDefined();

    const asyncOperationSelect = screen.getByRole('combobox', { name: 'select-operation-name' });
    expect(asyncOperationSelect).toBeInTheDocument();
    await user.click(asyncOperationSelect);
    jest.advanceTimersByTime(3000);

    await user.type(asyncOperationSelect, '$');
    const operationOption = await screen.findByText('$operation');
    expect(operationOption).toBeDefined();
  });
});

function setupFetchMock(response: unknown, mock?: ReturnType<typeof backendSrv.fetch>) {
  const defaultMock = () => mock ?? of(createFetchResponse(response));

  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  fetchMock.mockImplementation(defaultMock);
  return fetchMock;
}

const defaultSettings: DataSourceInstanceSettings<JaegerJsonData> = {
  id: 0,
  uid: '0',
  type: 'tracing',
  name: 'jaeger',
  url: 'http://grafana.com',
  access: 'proxy',
  meta: {
    id: 'jaeger',
    name: 'jaeger',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  jsonData: {
    nodeGraph: {
      enabled: true,
    },
  },
  readOnly: false,
};

const defaultQuery: DataQueryRequest<JaegerQuery> = {
  requestId: '1',
  interval: '0',
  intervalMs: 10,
  panelId: 0,
  scopedVars: {},
  range: {
    from: dateTime().subtract(1, 'h'),
    to: dateTime(),
    raw: { from: '1h', to: 'now' },
  },
  timezone: 'browser',
  app: 'explore',
  startTime: 0,
  targets: [
    {
      query: '12345',
      refId: '1',
    },
  ],
};
