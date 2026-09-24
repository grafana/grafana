import { act, render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { SceneReactObject, type SceneObject } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';

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

  it('preserves form autofocus through loading and returns focus to the opener on close', async () => {
    const { dashboard, resolve, user, opener } = await openLoadingDrawer();
    await resolve(
      new SceneReactObject({
        reactNode: (
          <Drawer title="Loaded drawer" onClose={() => dashboard.closeModal()}>
            <textarea aria-label="Message" autoFocus />
          </Drawer>
        ),
      })
    );

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toHaveFocus());
    await user.keyboard('Change details');
    expect(message).toHaveValue('Change details');
    await user.click(screen.getByTestId(selectors.components.Drawer.General.close));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it.each(['close', 'failure', 'no drawer'])(
    'returns focus to the opener after loading ends with %s',
    async (action) => {
      const { pending, opening, resolve, user, opener } = await openLoadingDrawer();
      if (action === 'close') {
        await user.click(screen.getByTestId(selectors.components.Drawer.General.close));
        await resolve(undefined);
      } else if (action === 'failure') {
        await act(async () => {
          const rejected = expect(opening).rejects.toThrow('Chunk failed');
          pending.reject(new Error('Chunk failed'));
          await rejected;
        });
      } else {
        await resolve(undefined);
      }
      await waitFor(() => expect(opener).toHaveFocus());
      expect(screen.queryByRole('status', { name: 'Loading drawer' })).not.toBeInTheDocument();
    }
  );

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

async function openLoadingDrawer() {
  const dashboard = new DashboardScene({});
  const pending = createDeferred<SceneObject | undefined>();
  let opening!: Promise<void>;
  const { user } = render(
    <>
      <button
        onClick={() => {
          opening = dashboard.showModalAsync(() => pending.promise);
        }}
      >
        Open save
      </button>
      <DashboardOverlay dashboard={dashboard} />
    </>
  );
  const opener = screen.getByRole('button', { name: 'Open save' });
  await user.click(opener);
  expect(screen.getByRole('status', { name: 'Loading drawer' })).toBeVisible();
  return {
    dashboard,
    pending,
    opening,
    user,
    opener,
    resolve: async (overlay: SceneObject | undefined) => {
      await act(async () => {
        pending.resolve(overlay);
        await opening;
      });
    },
  };
}
