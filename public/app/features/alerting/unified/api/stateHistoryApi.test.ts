import { HttpResponse, http } from 'msw';

import { type DataFrameJSON, dateTimeParse } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';

import { setupMswServer } from '../mockApi';

import { stateHistoryApi } from './stateHistoryApi';

const server = setupMswServer();

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  dateTimeParse: jest.fn(jest.requireActual('@grafana/data').dateTimeParse),
}));

describe('getRuleHistory time bounds', () => {
  it.each([
    { name: 'numeric seconds', from: 0, to: 1769688000, expected: { from: '0', to: '1769688000' } },
    { name: 'relative from', from: 'now-30d', to: 1769688000, expected: { from: '1767096000', to: '1769688000' } },
    { name: 'relative to', from: 1767096000, to: 'now', expected: { from: '1767096000', to: '1769688000' } },
    { name: 'omitted bounds', from: undefined, to: undefined, expected: { from: null, to: null } },
    { name: 'invalid from', from: 'not-a-date', to: 1769688000, expected: { from: null, to: '1769688000' } },
    { name: 'invalid to', from: 0, to: 'not-a-date', expected: { from: '0', to: null } },
    { name: 'non-finite bounds', from: NaN, to: Infinity, expected: { from: null, to: null } },
  ])('sends $name correctly', async ({ from, to, expected }) => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-01-29T12:00:00Z'));
    let requestedBounds: { from: string | null; to: string | null } | undefined;
    server.use(
      http.get('/api/v1/rules/history', ({ request }) => {
        const params = new URL(request.url).searchParams;
        requestedBounds = { from: params.get('from'), to: params.get('to') };
        return HttpResponse.json<DataFrameJSON>({ data: { values: [] }, schema: { fields: [] } });
      })
    );
    const store = configureStore();

    try {
      await store.dispatch(stateHistoryApi.endpoints.getRuleHistory.initiate({ from, to })).unwrap();
      expect(requestedBounds).toEqual(expected);
    } finally {
      store.dispatch(stateHistoryApi.util.resetApiState());
      now.mockRestore();
    }
  });

  it('omits a bound when parsing throws', async () => {
    let requestedBounds: { from: string | null; to: string | null } | undefined;
    server.use(
      http.get('/api/v1/rules/history', ({ request }) => {
        const params = new URL(request.url).searchParams;
        requestedBounds = { from: params.get('from'), to: params.get('to') };
        return HttpResponse.json<DataFrameJSON>({ data: { values: [] }, schema: { fields: [] } });
      })
    );
    const store = configureStore();
    jest.mocked(dateTimeParse).mockImplementationOnce(() => {
      throw new Error('Parsing failed');
    });

    try {
      await store
        .dispatch(stateHistoryApi.endpoints.getRuleHistory.initiate({ from: 'now-30d', to: 1769688000 }))
        .unwrap();
      expect(requestedBounds).toEqual({ from: null, to: '1769688000' });
    } finally {
      store.dispatch(stateHistoryApi.util.resetApiState());
    }
  });
});
