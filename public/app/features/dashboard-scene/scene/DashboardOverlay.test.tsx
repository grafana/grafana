import { act, render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { SceneReactObject, type SceneObject } from '@grafana/scenes';

import { createDeferred } from '../utils/test-utils';

import { DashboardOverlay } from './DashboardOverlay';
import { DashboardScene } from './DashboardScene';

describe('DashboardOverlay loading', () => {
  let mainView: HTMLDivElement;

  beforeEach(() => {
    // Drawer portals into the application's main-view shell.
    mainView = document.createElement('div');
    mainView.className = 'main-view';
    document.body.appendChild(mainView);
    locationService.push('/d/loading-test');
  });

  afterEach(() => mainView.remove());

  it('replaces the loading bar with the resolved drawer content', async () => {
    const dashboard = new DashboardScene({});
    const pending = createDeferred<SceneObject>();
    const opening = dashboard.showModalAsync(() => pending.promise);
    render(<DashboardOverlay dashboard={dashboard} />);

    expect(screen.getByRole('status', { name: 'Loading drawer' })).toBeVisible();
    await act(async () => {
      pending.resolve(new SceneReactObject({ reactNode: <div>Loaded drawer</div> }));
      await opening;
    });

    expect(await screen.findByText('Loaded drawer')).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Loading drawer' })).not.toBeInTheDocument();
  });

  it.each(['close', 'navigation'])('cancels the loading drawer on %s without reopening it', async (action) => {
    const dashboard = new DashboardScene({});
    const pending = createDeferred<SceneObject>();
    const { user } = render(<DashboardOverlay dashboard={dashboard} />);
    let opening!: Promise<void>;
    act(() => {
      opening = dashboard.showModalAsync(() => pending.promise);
    });

    expect(screen.getByRole('status', { name: 'Loading drawer' })).toBeVisible();
    if (action === 'close') {
      await user.click(screen.getByTestId(selectors.components.Drawer.General.close));
    } else {
      act(() => locationService.push('/dashboards'));
    }
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading drawer' })).not.toBeInTheDocument());
    await act(async () => {
      pending.resolve(new SceneReactObject({ reactNode: <div>Stale drawer</div> }));
      await opening;
    });
    expect(screen.queryByText('Stale drawer')).not.toBeInTheDocument();

    await act(async () => {
      await dashboard.showModalAsync(async () => new SceneReactObject({ reactNode: <div>New drawer</div> }));
    });
    expect(await screen.findByText('New drawer')).toBeVisible();
  });

  it('keeps the bar until the newest load completes', async () => {
    const dashboard = new DashboardScene({});
    const older = createDeferred<SceneObject>();
    const newer = createDeferred<SceneObject>();
    const first = dashboard.showModalAsync(() => older.promise);
    const second = dashboard.showModalAsync(() => newer.promise);
    render(<DashboardOverlay dashboard={dashboard} />);

    expect(screen.getByRole('status', { name: 'Loading drawer' })).toBeVisible();
    await act(async () => {
      older.resolve(new SceneReactObject({ reactNode: <div>Older drawer</div> }));
      await first;
    });
    expect(screen.getByRole('status', { name: 'Loading drawer' })).toBeVisible();
    expect(screen.queryByText('Older drawer')).not.toBeInTheDocument();
    await act(async () => {
      newer.resolve(new SceneReactObject({ reactNode: <div>Newer drawer</div> }));
      await second;
    });
    expect(await screen.findByText('Newer drawer')).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Loading drawer' })).not.toBeInTheDocument();
  });

  it.each(['failure', 'no drawer'])('clears loading after %s and permits retry', async (result) => {
    const dashboard = new DashboardScene({});
    const pending = createDeferred<SceneObject | undefined>();
    const opening = dashboard.showModalAsync(() => pending.promise);
    render(<DashboardOverlay dashboard={dashboard} />);
    expect(screen.getByRole('status', { name: 'Loading drawer' })).toBeVisible();

    await act(async () => {
      if (result === 'failure') {
        const rejected = expect(opening).rejects.toThrow('Chunk failed');
        pending.reject(new Error('Chunk failed'));
        await rejected;
      } else {
        pending.resolve(undefined);
        await opening;
      }
    });
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading drawer' })).not.toBeInTheDocument());

    await act(async () => {
      await dashboard.showModalAsync(async () => new SceneReactObject({ reactNode: <div>Retried drawer</div> }));
    });
    expect(await screen.findByText('Retried drawer')).toBeVisible();
  });
});
