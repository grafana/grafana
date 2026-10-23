import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { locationService } from '@grafana/runtime';
import { QueryVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';
import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';

import { SavedViewsPane } from './SavedViewsPane';
import { savedDashboardViewsApi, type SavedDashboardView } from './api';
import { captureSavedViewState } from './state';

jest.mock('./api', () => ({
  savedDashboardViewsApi: {
    listForDashboard: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const api = jest.mocked(savedDashboardViewsApi);

function buildView(name: string, specOverrides?: Partial<SavedDashboardView['spec']>): SavedDashboardView {
  return {
    apiVersion: 'dashboardviews.grafana.app/v0alpha1',
    kind: 'SavedDashboardView',
    metadata: { name, resourceVersion: '1', creationTimestamp: '' },
    spec: {
      dashboardUID: 'dash-1',
      name,
      timeRange: { from: 'now-6h', to: 'now' },
      variables: [],
      ...specOverrides,
    },
  };
}

function WrapSidebar({ children }: { children: ReactNode }) {
  const sidebarContext = useSidebar({});
  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

function renderPane(savedViews?: SavedDashboardView[]) {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    savedViews,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
  });
  const pane = new SavedViewsPane({});
  scene.state.sidebar.openPane(pane);
  render(
    <WrapSidebar>
      <pane.Component model={pane} />
    </WrapSidebar>
  );
  return { scene, pane };
}

describe('SavedViewsPane', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state and fetches views when not yet loaded', async () => {
    api.listForDashboard.mockResolvedValue([buildView('view-1')]);

    renderPane(undefined);

    expect(screen.getByText(/Loading saved views/i)).toBeInTheDocument();
    await waitFor(() => expect(api.listForDashboard).toHaveBeenCalledWith('dash-1'));
  });

  it('shows an empty state when there are no saved views', () => {
    renderPane([]);

    expect(screen.getByText('No saved views yet')).toBeInTheDocument();
  });

  it('shows an error with a retry action when the initial fetch fails, instead of loading forever', async () => {
    api.listForDashboard.mockRejectedValueOnce(new Error('boom'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderPane(undefined);

    await screen.findByText('Failed to load saved views.');
    expect(screen.queryByText(/Loading saved views/i)).not.toBeInTheDocument();

    api.listForDashboard.mockResolvedValueOnce([buildView('view-1', { name: 'My view' })]);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await screen.findByText('My view');
    consoleErrorSpy.mockRestore();
  });

  it('selects a view by updating the URL', async () => {
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    renderPane([buildView('view-1', { name: 'My view' })]);

    await userEvent.click(screen.getByText('My view'));

    expect(partialSpy).toHaveBeenCalledWith({ viewFilter: 'view-1' });
    partialSpy.mockRestore();
  });

  it('sets viewFilter synchronously on select, before the url round-trip', async () => {
    // Lets DashboardSceneUrlSync's viewFilter guard skip a second apply when the URL catches up.
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    const { scene } = renderPane([buildView('view-1', { name: 'My view' })]);

    await userEvent.click(screen.getByText('My view'));

    expect(scene.state.viewFilter).toBe('view-1');
    partialSpy.mockRestore();
  });

  it('re-applies a saved view when its (already-selected) row is clicked again', async () => {
    // Re-clicking doesn't change the URL, so this must not rely on URL sync.
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    const { scene } = renderPane([
      buildView('view-1', { name: 'My view', timeRange: { from: 'now-24h', to: 'now-1h' } }),
    ]);

    await userEvent.click(screen.getByText('My view'));
    expect(scene.state.$timeRange?.state.from).toBe('now-24h');

    act(() => scene.state.$timeRange?.setState({ from: 'now-5m', to: 'now' }));
    expect(scene.state.$timeRange?.state.from).toBe('now-5m');

    await userEvent.click(screen.getByText('My view'));

    expect(scene.state.$timeRange?.state.from).toBe('now-24h');
    partialSpy.mockRestore();
  });

  it('resets a variable the selected view does not mention back to the dashboard baseline', async () => {
    // Selecting a view is a full switch: variables it omits reset to the baseline.
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    const team = new QueryVariable({ name: 'team', query: 'label_values(team)', value: 'platform', text: 'platform' });
    const scene = new DashboardScene({
      title: 'hello',
      uid: 'dash-1',
      $variables: new SceneVariableSet({ variables: [team] }),
      savedViews: [buildView('view-1', { name: 'My view', variables: [] })], // doesn't mention "team"
    });
    // The baseline URL sync would capture on load.
    team.setState({ value: '$__all', text: 'All' });
    scene.setState({ savedViewBaseline: captureSavedViewState(scene) });
    // Simulate the manual edit (or a previous view) that left team somewhere else entirely.
    team.setState({ value: 'platform', text: 'platform' });

    const pane = new SavedViewsPane({});
    scene.state.sidebar.openPane(pane);
    render(
      <WrapSidebar>
        <pane.Component model={pane} />
      </WrapSidebar>
    );

    await userEvent.click(screen.getByText('My view'));

    expect(team.state.value).toBe('$__all');
    partialSpy.mockRestore();
  });

  describe('Save changes', () => {
    it('is not shown until a view is active for the dashboard', () => {
      renderPane([buildView('view-1', { name: 'My view' })]);

      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    });

    it('shows only in the selected row, disabled while the dashboard matches the view', () => {
      const { scene } = renderPane([buildView('view-1', { name: 'My view' }), buildView('view-2', { name: 'Other' })]);

      act(() => scene.setState({ viewFilter: 'view-1' }));

      const buttons = screen.getAllByRole('button', { name: 'Save changes' });
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toBeDisabled();
    });

    it('enables once the time range drifts from the selected view', () => {
      const { scene } = renderPane([buildView('view-1', { name: 'My view' })]);
      act(() => scene.setState({ viewFilter: 'view-1' }));

      act(() => scene.state.$timeRange?.setState({ from: 'now-24h' }));

      expect(screen.getByRole('button', { name: 'Save changes' })).not.toBeDisabled();
    });

    it('stays disabled for a view that only captures part of the dashboard', () => {
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now', timeZone: 'browser' }),
        $variables: new SceneVariableSet({
          variables: [
            new QueryVariable({ name: 'env', query: '', value: 'prod', text: 'prod' }),
            new QueryVariable({ name: 'region', query: '', value: 'eu', text: 'eu' }),
          ],
        }),
        // No timezone, and region isn't captured at all.
        savedViews: [buildView('view-1', { variables: [{ name: 'env', type: 'query', value: 'prod' }] })],
        viewFilter: 'view-1',
      });
      const pane = new SavedViewsPane({});
      scene.state.sidebar.openPane(pane);
      render(
        <WrapSidebar>
          <pane.Component model={pane} />
        </WrapSidebar>
      );

      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('enables once a variable drifts from the selected view', async () => {
      const env = new QueryVariable({ name: 'env', query: '', value: 'prod', text: 'prod' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        $variables: new SceneVariableSet({ variables: [env] }),
        savedViews: [buildView('view-1', { variables: [{ name: 'env', type: 'query', value: 'prod' }] })],
        viewFilter: 'view-1',
      });
      const pane = new SavedViewsPane({});
      scene.state.sidebar.openPane(pane);
      render(
        <WrapSidebar>
          <pane.Component model={pane} />
        </WrapSidebar>
      );
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

      act(() => env.changeValueTo('dev', 'dev'));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).not.toBeDisabled());
    });
  });

  it('keeps the view name and saves the current state when saving changes', async () => {
    api.update.mockResolvedValue(buildView('view-1', { name: 'My view' }));
    const { scene } = renderPane([buildView('view-1', { name: 'My view' })]);
    act(() => scene.setState({ viewFilter: 'view-1' }));
    act(() => scene.state.$timeRange?.setState({ from: 'now-24h' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'My view', timeRange: expect.objectContaining({ from: 'now-24h' }) })
    );
  });

  it('deletes a view after confirming, and clears the selection if it was selected', async () => {
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    api.remove.mockResolvedValue(undefined);
    const { scene } = renderPane([buildView('view-1', { name: 'My view' })]);
    act(() => scene.setState({ viewFilter: 'view-1' }));

    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await userEvent.click(screen.getByTestId('data-testid Confirm Modal Danger Button'));

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('view-1'));
    expect(partialSpy).toHaveBeenCalledWith({ viewFilter: null });
    partialSpy.mockRestore();
  });

  describe('Edit title', () => {
    async function startEditingTitle() {
      await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit title' }));
      return screen.getByRole('textbox', { name: 'View title' });
    }

    it('swaps the title for an input in the row, without a dialog', async () => {
      renderPane([buildView('view-1', { name: 'My view' })]);

      const input = await startEditingTitle();

      expect(input).toHaveValue('My view');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
    });

    it('enables the checkmark only once the title has changed to something non-empty', async () => {
      renderPane([buildView('view-1', { name: 'My view' })]);
      const input = await startEditingTitle();
      const confirm = screen.getByRole('button', { name: 'Save title' });

      expect(confirm).toBeDisabled();

      await userEvent.clear(input);
      await userEvent.type(input, '   ');
      expect(confirm).toBeDisabled();

      await userEvent.clear(input);
      await userEvent.type(input, 'Renamed view');
      expect(confirm).not.toBeDisabled();
    });

    it('saves the new title on checkmark click', async () => {
      api.update.mockResolvedValue(buildView('view-1', { name: 'Renamed view' }));
      renderPane([buildView('view-1', { name: 'My view' })]);
      const input = await startEditingTitle();

      await userEvent.clear(input);
      await userEvent.type(input, 'Renamed view');
      await userEvent.click(screen.getByRole('button', { name: 'Save title' }));

      await waitFor(() => expect(api.update).toHaveBeenCalled());
      expect(api.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: 'Renamed view' }));
      expect(await screen.findByRole('button', { name: 'Renamed view' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'View title' })).not.toBeInTheDocument();
    });

    it('saves on Enter', async () => {
      api.update.mockResolvedValue(buildView('view-1', { name: 'Renamed view' }));
      renderPane([buildView('view-1', { name: 'My view' })]);
      const input = await startEditingTitle();

      await userEvent.clear(input);
      await userEvent.type(input, 'Renamed view{Enter}');

      await waitFor(() => expect(api.update).toHaveBeenCalled());
    });

    it.each([
      ['the X button', () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
      ['Escape', () => userEvent.keyboard('{Escape}')],
    ])('cancels via %s without saving', async (_, cancel) => {
      renderPane([buildView('view-1', { name: 'My view' })]);
      const input = await startEditingTitle();
      await userEvent.type(input, ' changed');

      await cancel();

      expect(screen.queryByRole('textbox', { name: 'View title' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'My view' })).toBeInTheDocument();
      expect(api.update).not.toHaveBeenCalled();
    });

    it('hides the selected row’s save-changes button while editing', async () => {
      const { scene } = renderPane([buildView('view-1', { name: 'My view' })]);
      act(() => scene.setState({ viewFilter: 'view-1' }));

      await startEditingTitle();

      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    });
  });

  it('filters the list by search query', async () => {
    renderPane([buildView('view-1', { name: 'Production' }), buildView('view-2', { name: 'Staging' })]);

    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Staging')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Search views'), 'prod');

    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.queryByText('Staging')).not.toBeInTheDocument();
  });

  it('shows a no-results message when the search query matches nothing', async () => {
    renderPane([buildView('view-1', { name: 'Production' })]);

    await userEvent.type(screen.getByPlaceholderText('Search views'), 'nonexistent');

    expect(screen.queryByText('Production')).not.toBeInTheDocument();
    expect(screen.getByText('No results found for your query')).toBeInTheDocument();
  });

  it('offers only Save new in the footer', () => {
    renderPane([buildView('view-1', { name: 'My view' })]);

    expect(screen.getByRole('button', { name: 'Save new' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  describe('Save new', () => {
    it('adds a draft row and swaps the footer for Cancel and a disabled Confirm, without a dialog', async () => {
      renderPane([buildView('view-1', { name: 'My view' })]);

      await userEvent.click(screen.getByRole('button', { name: 'Save new' }));

      expect(screen.getByRole('textbox', { name: 'New view title' })).toHaveValue('');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save new' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });

    it('scrolls the whole draft row into view, not just its input', async () => {
      renderPane([buildView('view-1', { name: 'My view' })]);

      await userEvent.click(screen.getByRole('button', { name: 'Save new' }));

      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    });

    it('replaces the empty state with the draft row when there are no views yet', async () => {
      renderPane([]);

      await userEvent.click(screen.getByRole('button', { name: 'Save new' }));

      expect(screen.queryByText('No saved views yet')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'New view title' })).toBeInTheDocument();
    });

    it('keeps Confirm disabled for a whitespace-only title', async () => {
      renderPane([]);
      await userEvent.click(screen.getByRole('button', { name: 'Save new' }));

      await userEvent.type(screen.getByRole('textbox', { name: 'New view title' }), '   ');

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });

    it.each([
      ['Confirm', () => userEvent.click(screen.getByRole('button', { name: 'Confirm' }))],
      ['Enter', () => userEvent.keyboard('{Enter}')],
    ])('creates the view via %s and selects it', async (_, confirm) => {
      api.create.mockResolvedValue(buildView('view-2', { name: 'New view' }));
      const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
      renderPane([]);
      await userEvent.click(screen.getByRole('button', { name: 'Save new' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'New view title' }), 'New view');

      await confirm();

      await waitFor(() => expect(api.create).toHaveBeenCalled());
      expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ dashboardUID: 'dash-1', name: 'New view' }));
      expect(partialSpy).toHaveBeenCalledWith({ viewFilter: 'view-2' });
      expect(await screen.findByRole('button', { name: 'New view' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'New view title' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save new' })).toBeInTheDocument();
      partialSpy.mockRestore();
    });

    it.each([
      ['Cancel', () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
      ['Escape', () => userEvent.keyboard('{Escape}')],
    ])('discards the draft via %s without creating a view', async (_, cancel) => {
      renderPane([]);
      await userEvent.click(screen.getByRole('button', { name: 'Save new' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'New view title' }), 'Discarded');

      await cancel();

      expect(screen.queryByRole('textbox', { name: 'New view title' })).not.toBeInTheDocument();
      expect(screen.getByText('No saved views yet')).toBeInTheDocument();
      expect(api.create).not.toHaveBeenCalled();
    });
  });
});
