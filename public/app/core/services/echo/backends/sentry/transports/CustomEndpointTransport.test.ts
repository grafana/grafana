import { Event, Severity } from '@sentry/browser';
import { CustomEndpointTransport } from './CustomEndpointTransport';

describe('CustomEndpointTransport', () => {
  const fetchSpy = (window.fetch = jest.fn());
  beforeEach(() => jest.resetAllMocks());
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
    fetchSpy.mockResolvedValue({ status: 200 } as Response);
    const transport = new CustomEndpointTransport({ endpoint: '/log' });
    await transport.sendEvent(event);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, reqInit]: [string, RequestInit] = fetchSpy.mock.calls[0];
    expect(url).toEqual('/log');
    expect(reqInit.method).toEqual('POST');
    expect(reqInit.headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(reqInit.body as string)).toEqual({
      ...event,
      timestamp: now.toISOString(),
    });
  });

  it('will back off if backend returns Retry-After', async () => {
    const rateLimiterResponse = {
      status: 429,
      ok: false,
      headers: (new Headers({
        'Retry-After': '1', // 1 second
      }) as any) as Headers,
    } as Response;
    fetchSpy.mockResolvedValueOnce(rateLimiterResponse).mockResolvedValueOnce({ status: 200 } as Response);
    const transport = new CustomEndpointTransport({ endpoint: '/log' });

    // first call - backend is called, rejected because of 429
    await expect(transport.sendEvent(event)).rejects.toEqual(rateLimiterResponse);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // second immediate call - shot circuited because retry-after time has not expired, backend not called
    await expect(transport.sendEvent(event)).rejects.toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // wait out the retry-after and call again - great success
    await new Promise((resolve) => setTimeout(() => resolve(null), 1001));
    await expect(transport.sendEvent(event)).resolves.toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
