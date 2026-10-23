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
});
