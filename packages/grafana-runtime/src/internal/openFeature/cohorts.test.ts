import { config } from '../../config';

import { loadGrowthCohortContext } from './cohorts';

import { initOpenFeature } from './index';

const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const originalFetch = global.fetch;
const originalContext = config.openFeatureContext;
const originalSignedIn = config.bootData.user.isSignedIn;
const originalSubUrl = config.appSubUrl;
const originalNamespace = config.namespace;

beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
  config.bootData.user.isSignedIn = true;
  config.appSubUrl = '/grafana';
  config.namespace = 'stacks-1';
  config.openFeatureContext = { gcomOrgID: '123', unrelated: 'keep' };
});

afterEach(() => {
  global.fetch = originalFetch;
  config.openFeatureContext = originalContext;
  config.bootData.user.isSignedIn = originalSignedIn;
  config.appSubUrl = originalSubUrl;
  config.namespace = originalNamespace;
  jest.useRealTimers();
});

it.each([{ cohorts: ['pilot'] }, { cohorts: [] }])(
  'loads typed membership $cohorts through the same-origin proxy',
  async ({ cohorts }) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ cohorts })));
    expect(await loadGrowthCohortContext()).toEqual({ growthCohorts: cohorts, growthCohortsAvailable: true });
    expect(fetchMock).toHaveBeenCalledWith('/grafana/api/gnet/growth/cohorts/123', {
      credentials: 'same-origin',
      signal: expect.any(AbortSignal),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }
);

it.each([403, 500])('returns unavailable membership for HTTP %i', async (status) => {
  fetchMock.mockResolvedValue(new Response('{}', { status }));
  expect(await loadGrowthCohortContext()).toEqual({ growthCohorts: [], growthCohortsAvailable: false });
});

it.each([{ cohorts: 'pilot' }, { cohorts: [42] }, null])('rejects invalid membership %j', async (body) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));
  expect(await loadGrowthCohortContext()).toEqual({ growthCohorts: [], growthCohortsAvailable: false });
});

it.each([undefined, '../123', 123])('skips lookup without a canonical cloud organization string: %s', async (orgID) => {
  config.openFeatureContext = { gcomOrgID: orgID };
  expect(await loadGrowthCohortContext()).toEqual({ growthCohorts: [], growthCohortsAvailable: false });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('skips lookup for signed-out users', async () => {
  config.bootData.user.isSignedIn = false;
  expect(await loadGrowthCohortContext()).toEqual({ growthCohorts: [], growthCohortsAvailable: false });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('aborts a slow lookup so ordinary flags can initialize', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })
  );
  const result = loadGrowthCohortContext();
  await jest.advanceTimersByTimeAsync(1000);
  expect(await result).toEqual({ growthCohorts: [], growthCohortsAvailable: false });
});

it('passes cohorts and unrelated attributes into the real provider evaluation request', async () => {
  const contexts: unknown[] = [];
  fetchMock.mockImplementation(async (url, options) => {
    if (String(url).includes('/api/gnet/')) {
      return new Response(JSON.stringify({ cohorts: ['pilot'] }));
    }
    contexts.push(url instanceof Request ? (await url.json()).context : JSON.parse(String(options?.body)).context);
    return new Response(JSON.stringify({ flags: [] }), { headers: { 'Content-Type': 'application/json' } });
  });
  await initOpenFeature();
  expect(contexts).toEqual([
    {
      targetingKey: 'stacks-1',
      gcomOrgID: '123',
      unrelated: 'keep',
      growthCohorts: ['pilot'],
      growthCohortsAvailable: true,
    },
  ]);
});
