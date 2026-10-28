import { Suspense } from 'react';
import { act, render, screen } from 'test/test-utils';

import { ErrorBoundary } from '@grafana/ui';

import { STPodReadinessCheck } from './STPodReadinessCheck';
import { invalidateStPodReadiness, markStPodReady, markStPodTimeout, markStPodWaiting } from './stPodReadiness';

// The gate suspends during its first render, and React requires the surrounding act() to be
// awaited when that happens — RTL's own render() only wraps a synchronous one.
async function renderGate(skip: boolean) {
  await act(async () => {
    render(
      <Suspense fallback={<div>waiting for pod</div>}>
        <STPodReadinessCheck skip={skip} />
        <div>the page</div>
      </Suspense>
    );
  });
}

// The boundary has to sit outside the Suspense, mirroring GrafanaRoute, so a throw from the
// gate is caught rather than bubbling out of the render.
async function renderGateWithBoundary() {
  await act(async () => {
    render(
      <ErrorBoundary>
        {({ error }) =>
          error ? (
            <div>caught: {error.message}</div>
          ) : (
            <Suspense fallback={<div>waiting for pod</div>}>
              <STPodReadinessCheck skip={false} />
              <div>the page</div>
            </Suspense>
          )
        }
      </ErrorBoundary>
    );
  });
}

describe('STPodReadinessCheck', () => {
  beforeEach(() => {
    invalidateStPodReadiness();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the page without suspending when the check is skipped', async () => {
    await renderGate(true);

    expect(await screen.findByText('the page')).toBeInTheDocument();
  });

  it('suspends while the pod is waiting', async () => {
    markStPodWaiting();

    await renderGate(false);

    expect(await screen.findByText('waiting for pod')).toBeInTheDocument();
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
  });

  it('suspends before the first health answer arrives', async () => {
    await renderGate(false);

    expect(await screen.findByText('waiting for pod')).toBeInTheDocument();
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
  });

  it('renders the page once the pod is ready', async () => {
    markStPodReady();

    await renderGate(false);

    expect(await screen.findByText('the page')).toBeInTheDocument();
  });

  it('throws once the wait has been abandoned so the surrounding boundary can react', async () => {
    // React logs every boundary-caught error, and jest-fail-on-console would fail the test.
    jest.spyOn(console, 'error').mockImplementation();
    markStPodTimeout();

    await renderGateWithBoundary();

    expect(await screen.findByText(/^caught:/)).toBeInTheDocument();
  });
});
