import { HttpResponse, http } from 'msw';
import { act, render, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { STPodHealthPoller } from './STPodHealthPoller';
import { getStPodStatus, invalidateStPodReadiness } from './stPodReadiness';

setBackendSrv(backendSrv);
setupMockServer();

const podUp = () => HttpResponse.json({ database: 'ok' });
const podDown = () => HttpResponse.json({ code: 'NotFound' }, { status: 404 });

const mockHealth = (respond: () => Response) => {
  const requested = jest.fn();

  server.use(
    http.get('/api/health', () => {
      requested();
      return respond();
    })
  );

  return requested;
};

describe('STPodHealthPoller', () => {
  beforeEach(() => {
    invalidateStPodReadiness();
  });

  it('marks the pod ready when the health endpoint reports the database is ok', async () => {
    mockHealth(podUp);

    render(<STPodHealthPoller skip={false} />);

    await waitFor(() => expect(getStPodStatus()).toBe('ready'));
  });

  it('issues no health request and leaves the status unknown when the url is allow-listed', async () => {
    const requested = mockHealth(podUp);

    render(<STPodHealthPoller skip={true} />);

    // Flush effects and microtasks so a request fired asynchronously would have landed by now.
    // The sibling test proves requests do reach msw through this harness, so this absence is meaningful.
    await act(async () => {});

    expect(requested).not.toHaveBeenCalled();
    expect(getStPodStatus()).toBe('unknown');
  });

  it('marks the pod waiting when the health endpoint reports not found', async () => {
    mockHealth(podDown);

    render(<STPodHealthPoller skip={false} />);

    await waitFor(() => expect(getStPodStatus()).toBe('waiting'));
  });

  describe('timing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('polls the health endpoint again after 10 seconds while the pod is not ready', async () => {
      const requested = mockHealth(podDown);

      render(<STPodHealthPoller skip={false} />);
      await waitFor(() => expect(getStPodStatus()).toBe('waiting'));

      expect(requested).toHaveBeenCalledTimes(1);

      // advanceTimersByTimeAsync, not advanceTimersByTime: the polling timer kicks off a fetch,
      // and only the async variant flushes the microtasks that let that fetch settle.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });

      expect(requested).toHaveBeenCalledTimes(2);
    });

    it('gives up after five minutes without the pod becoming ready', async () => {
      mockHealth(podDown);

      render(<STPodHealthPoller skip={false} />);
      await waitFor(() => expect(getStPodStatus()).toBe('waiting'));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5 * 60_000);
      });

      expect(getStPodStatus()).toBe('gaveUp');
    });

    it('does not give up after the poller has unmounted', async () => {
      mockHealth(podDown);

      const { unmount } = render(<STPodHealthPoller skip={false} />);
      await waitFor(() => expect(getStPodStatus()).toBe('waiting'));

      unmount();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5 * 60_000);
      });

      expect(getStPodStatus()).toBe('waiting');
    });

    it('stops polling once the pod is ready', async () => {
      const requested = mockHealth(podUp);

      render(<STPodHealthPoller skip={false} />);
      await waitFor(() => expect(getStPodStatus()).toBe('ready'));

      expect(requested).toHaveBeenCalledTimes(1);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });

      expect(requested).toHaveBeenCalledTimes(1);
    });
  });
});
