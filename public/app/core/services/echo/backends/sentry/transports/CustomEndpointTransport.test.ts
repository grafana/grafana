import { Event, Severity } from '@sentry/browser';

import { CustomEndpointTransport } from './CustomEndpointTransport';

describe('CustomEndpointTransport', () => {
  const fetchSpy = (window.fetch = jest.fn());
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    // The code logs a warning to console
    // Let's stub this out so we don't pollute the test output
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });
  const now = new Date();

  const event: Event = {
    level: Severity.Error,
    breadcrumbs: [],
    exception: {
      values: [
        {
          type: 'SomeError',
          value: 'foo',
        },
      ],
    },
    timestamp: now.getTime() / 1000,
  };

  it('will send received event to backend using window.fetch', async () => {
    fetchSpy.mockResolvedValue({ status: 200 });
    const transport = new CustomEndpointTransport({ endpoint: '/log' });
    await transport.sendEvent(event);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, reqInit]: [string, RequestInit] = fetchSpy.mock.calls[0];
    expect(url).toEqual('/log');
    expect(reqInit.method).toEqual('POST');
    expect(reqInit.headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(reqInit.body!.toString())).toEqual({
      ...event,
      timestamp: now.toISOString(),
    });
  });

  it('will back off if backend returns Retry-After', async () => {
    const rateLimiterResponse = {
      status: 429,
      ok: false,
      headers: new Headers({
        'Retry-After': '1', // 1 second
      }),
    } as Response;
    fetchSpy.mockResolvedValueOnce(rateLimiterResponse).mockResolvedValueOnce({ status: 200 });
    const transport = new CustomEndpointTransport({ endpoint: '/log' });

    // first call - backend is called, rejected because of 429
    await expect(transport.sendEvent(event)).rejects.toEqual(rateLimiterResponse);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // second immediate call - shot circuited because retry-after time has not expired, backend not called
    await expect(transport.sendEvent(event)).resolves.toHaveProperty('status', 'skipped');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // wait out the retry-after and call again - great success
    await new Promise((resolve) => setTimeout(() => resolve(null), 1001));
    await expect(transport.sendEvent(event)).resolves.toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('will back off if backend returns Retry-After', async () => {
    const rateLimiterResponse = {
      status: 429,
      ok: false,
      headers: new Headers({
        'Retry-After': '1', // 1 second
      }),
    } as Response;
    fetchSpy.mockResolvedValueOnce(rateLimiterResponse).mockResolvedValueOnce({ status: 200 });
    const transport = new CustomEndpointTransport({ endpoint: '/log' });

    // first call - backend is called, rejected because of 429
    await expect(transport.sendEvent(event)).rejects.toHaveProperty('status', 429);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // second immediate call - shot circuited because retry-after time has not expired, backend not called
    await expect(transport.sendEvent(event)).resolves.toHaveProperty('status', 'skipped');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // wait out the retry-after and call again - great success
    await new Promise((resolve) => setTimeout(() => resolve(null), 1001));
    await expect(transport.sendEvent(event)).resolves.toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('will drop events and log a warning to console if max concurrency is reached', async () => {
    const calls: Array<(value: unknown) => void> = [];
    fetchSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          calls.push(resolve);
        })
    );

    const transport = new CustomEndpointTransport({ endpoint: '/log', maxConcurrentRequests: 2 });

    // first two requests are accepted
    transport.sendEvent(event);
    const event2 = transport.sendEvent(event);
    expect(calls).toHaveLength(2);

    // third is skipped because too many requests in flight
    await expect(transport.sendEvent(event)).resolves.toHaveProperty('status', 'skipped');

    expect(calls).toHaveLength(2);

    // after resolving in flight requests, next request is accepted as well
    calls.forEach((call) => {
      call({ status: 200 });
    });
    await event2;
    const event3 = transport.sendEvent(event);
    expect(calls).toHaveLength(3);
    calls[2]({ status: 200 });
    await event3;
  });
});
