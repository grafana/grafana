import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { PreviewModeControls } from './PreviewModeControls';
import { EditDashboardSwitch } from './new-toolbar/actions/EditDashboardSwitch';
import { SaveDashboard } from './new-toolbar/actions/SaveDashboard';

describe('PreviewModeControls', () => {
  let deactivate = () => {};

  beforeEach(() => {
    setTestFlags({ 'grafana.dashboardPreviewMode': true });
    locationService.push('/d/review-test');
  });

  afterEach(() => {
    cleanup();
    deactivate();
    setTestFlags({});
  });

  function setup({ isNew = false } = {}) {
    const dashboard = transformSaveModelToScene({
      dashboard: {
        title: 'Dashboard before editing',
        uid: isNew ? '' : 'review-test',
        version: isNew ? 0 : 1,
        schemaVersion: 39,
        panels: [],
      },
      meta: { canEdit: true, canSave: true },
    });
    dashboard.setState({ $data: undefined });
    dashboard.setInitialSaveModel(transformSceneToSaveModel(dashboard));
    deactivate = dashboard.activate();
    dashboard.onEnterEditMode();

    render(
      <TestProvider>
        <PreviewModeControls dashboard={dashboard} />
        <EditDashboardSwitch dashboard={dashboard} />
        <SaveDashboard dashboard={dashboard} />
      </TestProvider>
    );

    return { dashboard, user: userEvent.setup() };
  }

  it.each([
    { isNew: false, name: 'saved' },
    { isNew: true, name: 'new unsaved' },
  ])('lets a user switch a $name dashboard from Edit to Preview and back without losing edits', async ({ isNew }) => {
    const { dashboard, user } = setup({ isNew });
    act(() => dashboard.setState({ title: 'Unsaved dashboard title' }));

    await user.click(screen.getByRole('switch', { name: 'Preview', checked: false }));

    expect(screen.getByRole('switch', { name: 'Preview', checked: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit edit mode' })).toBeInTheDocument();
    expect(dashboard.getSaveModel().title).toBe('Unsaved dashboard title');

    await user.click(screen.getByRole('switch', { name: 'Preview', checked: true }));

    expect(screen.getByRole('switch', { name: 'Preview', checked: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit edit mode' })).toBeInTheDocument();
    expect(dashboard.getSaveModel().title).toBe('Unsaved dashboard title');
    expect(dashboard.state.isEditing).toBe(true);
    expect(screen.queryByRole('button', { name: 'View changes' })).not.toBeInTheDocument();
  });

  it('hides the toggle when the OpenFeature flag is disabled', () => {
    setTestFlags({ 'grafana.dashboardPreviewMode': false });
    const { dashboard } = setup();

    expect(dashboard.state.isEditing).toBe(true);
    expect(screen.queryByRole('switch', { name: 'Preview' })).not.toBeInTheDocument();
  });

  it('keeps a way back to Edit if the flag is disabled while reviewing', async () => {
    const { dashboard, user } = setup();
    await user.click(screen.getByRole('switch', { name: 'Preview' }));

    act(() => setTestFlags({ 'grafana.dashboardPreviewMode': false }));
    await user.click(screen.getByRole('switch', { name: 'Preview', checked: true }));

    expect(dashboard.state.editPresentation).toBe('full');
    await waitFor(() => expect(screen.queryByRole('switch', { name: 'Preview' })).not.toBeInTheDocument());
  });

  it('opens Changes in the existing save drawer without dropping save options', async () => {
    const { dashboard, user } = setup();
    act(() => dashboard.openSaveDrawer({ saveAsCopy: true }));
    const drawer = dashboard.state.overlay;
    if (!(drawer instanceof SaveDashboardDrawer)) {
      throw new Error('Expected a save drawer');
    }

    await user.click(screen.getByRole('switch', { name: 'Preview' }));
    await user.click(screen.getByRole('button', { name: 'More save options' }));
    await user.click(screen.getByRole('menuitem', { name: 'View changes' }));

    expect(dashboard.state.overlay === drawer).toBe(true);
    expect(drawer.state.showDiff).toBe(true);
    expect(drawer.state.saveAsCopy).toBe(true);
  });

  it('exits a clean preview and returns to view mode', async () => {
    const { dashboard, user } = setup();
    await user.click(screen.getByRole('switch', { name: 'Preview' }));

    expect(screen.getByRole('button', { name: 'Exit edit mode' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Exit edit mode' }));

    expect(dashboard.state.isEditing).toBe(false);
    expect(dashboard.getSaveModel().title).toBe('Dashboard before editing');
    expect(dashboard.state.editPresentation).toBeUndefined();
  });

  it('confirms discarding edits when exiting preview and restores the baseline after confirmation', async () => {
    const { dashboard, user } = setup();
    await user.click(screen.getByRole('switch', { name: 'Preview' }));
    expect(screen.getByRole('button', { name: 'Exit edit mode' })).toBeInTheDocument();

    act(() => dashboard.setState({ title: 'Changed while reviewing' }));

    expect(await screen.findByRole('button', { name: 'Exit edit mode' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exit edit mode' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));

    expect(dashboard.getSaveModel().title).toBe('Dashboard before editing');
    expect(dashboard.state.isEditing).toBe(false);
    expect(dashboard.state.editPresentation).toBeUndefined();
  });
});
