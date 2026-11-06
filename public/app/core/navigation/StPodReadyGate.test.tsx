import { Suspense } from 'react';
import { act, getWrapper, render, screen } from 'test/test-utils';

import { StPodReadyService, StPodStatus } from '../services/StPodReadyService';

import { StPodReadyGate } from './StPodReadyGate';

async function renderGate(skip: boolean, service: StPodReadyService) {
  const wrapper = getWrapper({ grafanaContext: { stPodReady: service }, renderWithRouter: true });
  await act(async () => {
    render(
      <Suspense fallback={<div>waiting for pod</div>}>
        <StPodReadyGate skip={skip} />
        <div>the page</div>
      </Suspense>,
      { wrapper }
    );
  });
}

describe('StPodReadyGate', () => {
  let service: StPodReadyService;

  beforeEach(() => {
    service = new StPodReadyService();
  });

  afterEach(() => {
    service.stop();
  });

  it('renders the page without suspending when the check is skipped', async () => {
    await renderGate(true, service);

    expect(await screen.findByText('the page')).toBeInTheDocument();
  });

  it('does not suspend before the first health answer arrives', async () => {
    await renderGate(false, service);

    expect(await screen.findByText('the page')).toBeInTheDocument();
    expect(screen.queryByText('waiting for pod')).not.toBeInTheDocument();
  });

  it('suspends while the pod is waiting', async () => {
    service.state.next(StPodStatus.Waiting);

    await renderGate(false, service);

    expect(await screen.findByText('waiting for pod')).toBeInTheDocument();
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
  });

  it('renders the page once the pod is ready', async () => {
    service.state.next(StPodStatus.Ready);

    await renderGate(false, service);

    expect(await screen.findByText('the page')).toBeInTheDocument();
  });

  it('keeps suspending on timeout so the loader stays mounted for its banner', async () => {
    service.state.next(StPodStatus.Timeout);

    await renderGate(false, service);

    expect(await screen.findByText('waiting for pod')).toBeInTheDocument();
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
  });

  it('keeps suspending on error so the loader fallback can render the error card', async () => {
    service.state.next(StPodStatus.Error);

    await renderGate(false, service);

    expect(await screen.findByText('waiting for pod')).toBeInTheDocument();
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
  });

  describe('page reload', () => {
    const originalLocation = window.location;
    let reloadSpy: jest.Mock;

    beforeEach(() => {
      reloadSpy = jest.fn();
      const stub = Object.create(originalLocation, {
        reload: { configurable: true, value: reloadSpy },
      });
      Object.defineProperty(window, 'location', { configurable: true, value: stub });
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });

    it.each<[StPodStatus, number]>([
      [StPodStatus.Unknown, 0],
      [StPodStatus.Waiting, 0],
      [StPodStatus.Ready, 0],
      [StPodStatus.Timeout, 0],
      [StPodStatus.Error, 0],
      [StPodStatus.Captcha, 1],
    ])('reloads the page %i times when status is %s', async (status, expectedReloads) => {
      service.state.next(status);

      await renderGate(false, service);

      expect(reloadSpy).toHaveBeenCalledTimes(expectedReloads);
    });

    it('does not suspend on captcha so the browser can navigate before the reload', async () => {
      service.state.next(StPodStatus.Captcha);

      await renderGate(false, service);

      expect(screen.queryByText('waiting for pod')).not.toBeInTheDocument();
    });

    it('does not reload on captcha when the check is skipped', async () => {
      service.state.next(StPodStatus.Captcha);

      await renderGate(true, service);

      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });
});
