import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { locationService } from '@grafana/runtime';
import { Sidebar, useSidebar } from '@grafana/ui';

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

  it('selects a view by updating the URL', async () => {
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    renderPane([buildView('view-1', { name: 'My view' })]);

    await userEvent.click(screen.getByText('My view'));

    expect(partialSpy).toHaveBeenCalledWith({ viewFilter: 'view-1' });
    partialSpy.mockRestore();
  });

  it('disables Overwrite when no view is selected', () => {
    renderPane([buildView('view-1', { name: 'My view' })]);

    expect(screen.getByRole('button', { name: 'Overwrite selected view' })).toBeDisabled();
  });

  it('deletes a view after confirming, and clears the selection if it was selected', async () => {
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    api.remove.mockResolvedValue(undefined);
    const { scene } = renderPane([buildView('view-1', { name: 'My view' })]);
    act(() => scene.setState({ viewFilter: 'view-1' }));

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByTestId('data-testid Confirm Modal Danger Button'));

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('view-1'));
    expect(partialSpy).toHaveBeenCalledWith({ viewFilter: null });
    partialSpy.mockRestore();
  });

  it('saves the current state as a new view', async () => {
    const created = buildView('view-2', { name: 'New view' });
    api.create.mockResolvedValue(created);
    const partialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    renderPane([]);

    await userEvent.type(screen.getByPlaceholderText('New view name'), 'New view');
    await userEvent.click(screen.getByText('Save as new view'));

    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ dashboardUID: 'dash-1', name: 'New view' }));
    expect(partialSpy).toHaveBeenCalledWith({ viewFilter: 'view-2' });
    partialSpy.mockRestore();
  });
});
