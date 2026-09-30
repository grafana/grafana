import { skipToken } from '@reduxjs/toolkit/query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { locationService } from '@grafana/runtime';
import { Sidebar, useSidebar } from '@grafana/ui';
import { AnnoKeyCreatedBy } from 'app/features/apiserver/types';

import { DashboardScene } from '../scene/DashboardScene';

import { SavedViewsPane } from './SavedViewsPane';
import { savedDashboardViewsApi, type SavedDashboardView } from './api';

jest.mock('./api', () => ({
  savedDashboardViewsApi: {
    listForDashboard: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockUseGetDisplayMappingQuery = jest.fn().mockReturnValue({ data: undefined });
jest.mock('app/api/clients/iam/v0alpha1', () => ({
  useGetDisplayMappingQuery: (...args: unknown[]) => mockUseGetDisplayMappingQuery(...args),
}));

const api = jest.mocked(savedDashboardViewsApi);

function buildView(
  name: string,
  specOverrides?: Partial<SavedDashboardView['spec']>,
  metadataOverrides?: Partial<SavedDashboardView['metadata']>
): SavedDashboardView {
  return {
    apiVersion: 'dashboardviews.grafana.app/v0alpha1',
    kind: 'SavedDashboardView',
    metadata: { name, resourceVersion: '1', creationTimestamp: '', ...metadataOverrides },
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
  const scene = new DashboardScene({ title: 'hello', uid: 'dash-1', savedViews });
  const pane = new SavedViewsPane({});
  scene.state.sidebar.openPane(pane);
  render(
    <WrapSidebar>
      <pane.Component model={pane} />
    </WrapSidebar>
  );
  return { scene, pane };
}

async function toggleExpanded() {
  await userEvent.click(screen.getByRole('button', { name: 'Show details' }));
}

describe('SavedViewsPane', () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockUseGetDisplayMappingQuery.mockReturnValue({ data: undefined });
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
    // Part of the double-apply fix: DashboardSceneUrlSync's viewFilter handling only fires when
    // the url value actually changes, so this synchronous write (done here, ahead of
    // locationService.partial) is what makes a genuinely-new selection apply exactly once in a
    // real app where a UrlSyncManager is live, instead of once here plus once more there.
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    const { scene } = renderPane([buildView('view-1', { name: 'My view' })]);

    await userEvent.click(screen.getByText('My view'));

    expect(scene.state.viewFilter).toBe('view-1');
    partialSpy.mockRestore();
  });

  it('re-applies a saved view when its (already-selected) row is clicked again', async () => {
    // Regression test: DashboardSceneUrlSync only applies a saved view when the URL's viewFilter
    // value actually changes, so re-clicking the currently-selected view -- after editing the time
    // range/variables locally and wanting to snap back -- must not depend on that URL diff, or it's
    // a silent no-op (found via manual testing on a real dashboard).
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

  it('disables Overwrite until a view is active for the dashboard, then enables it', () => {
    const { scene } = renderPane([buildView('view-1', { name: 'My view' })]);

    expect(screen.getByRole('button', { name: 'Overwrite' })).toHaveAttribute('aria-disabled', 'true');

    act(() => scene.setState({ viewFilter: 'view-1' }));

    expect(screen.getByRole('button', { name: 'Overwrite' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('preserves an existing description when overwriting', async () => {
    api.update.mockResolvedValue(buildView('view-1', { name: 'My view', description: 'Original note' }));
    const { scene } = renderPane([buildView('view-1', { name: 'My view', description: 'Original note' })]);
    act(() => scene.setState({ viewFilter: 'view-1' }));

    await userEvent.click(screen.getByRole('button', { name: 'Overwrite' }));

    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ description: 'Original note' })
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

  it('edits a view via the actions menu, including its description', async () => {
    const updated = buildView('view-1', { name: 'Renamed view', description: 'New description' });
    api.update.mockResolvedValue(updated);
    renderPane([buildView('view-1', { name: 'My view', description: 'Old description' })]);

    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit view' })).toBeInTheDocument();
    const nameInput = screen.getByDisplayValue('My view');
    const descriptionInput = screen.getByDisplayValue('Old description');

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Renamed view');
    await userEvent.clear(descriptionInput);
    await userEvent.type(descriptionInput, 'New description');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Renamed view', description: 'New description' })
    );
    expect(screen.getByText('Renamed view')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit view' })).not.toBeInTheDocument();
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

  it('opens a modal to save the current state as a new view, including a description', async () => {
    const created = buildView('view-2', { name: 'New view', description: 'A note' });
    api.create.mockResolvedValue(created);
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    renderPane([]);

    await userEvent.click(screen.getByRole('button', { name: 'Save new' }));
    expect(screen.getByRole('heading', { name: 'Save new view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText('New view name'), 'New view');
    await userEvent.type(screen.getByPlaceholderText('Add a description (optional)'), 'A note');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardUID: 'dash-1', name: 'New view', description: 'A note' })
    );
    expect(partialSpy).toHaveBeenCalledWith({ viewFilter: 'view-2' });
    expect(screen.queryByRole('heading', { name: 'Save new view' })).not.toBeInTheDocument();
    partialSpy.mockRestore();
  });

  it('cancels the save-new modal without creating a view', async () => {
    renderPane([]);

    await userEvent.click(screen.getByRole('button', { name: 'Save new' }));
    await userEvent.type(screen.getByPlaceholderText('New view name'), 'Discarded');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Save new view' })).not.toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  describe('compact/expanded toggle', () => {
    it('hides description and author by default, and reveals them when expanded', async () => {
      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: { display: [{ identity: { type: 'user', name: 'abc123' }, displayName: 'Jane Doe' }] },
      });
      renderPane([
        buildView(
          'view-1',
          { name: 'My view', description: 'A helpful note' },
          { annotations: { [AnnoKeyCreatedBy]: 'user:abc123' } }
        ),
      ]);

      expect(screen.queryByText('A helpful note')).not.toBeInTheDocument();
      expect(screen.queryByText('Created by Jane Doe')).not.toBeInTheDocument();

      await toggleExpanded();

      expect(screen.getByText('A helpful note')).toBeInTheDocument();
      expect(screen.getByText('Created by Jane Doe')).toBeInTheDocument();
    });

    it('does not query for display names while compact', () => {
      renderPane([buildView('view-1', { name: 'My view' }, { annotations: { [AnnoKeyCreatedBy]: 'user:abc123' } })]);

      expect(mockUseGetDisplayMappingQuery).toHaveBeenCalledWith(skipToken);
    });

    it('omits the meta row entirely when a view has neither a description nor a resolvable author', async () => {
      renderPane([buildView('view-1', { name: 'My view' })]);

      await toggleExpanded();

      expect(screen.queryByText(/Created by/)).not.toBeInTheDocument();
    });
  });
});
