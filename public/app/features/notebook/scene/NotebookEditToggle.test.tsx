import { createMemoryHistory } from 'history';
import { act, render, screen } from 'test/test-utils';

import { HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';

import { NotebookEditToggle } from './NotebookEditToggle';
import { NotebookScene } from './NotebookScene';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

function buildScene() {
  return new NotebookScene({
    title: 'My notebook',
    body: new NotebookLayoutManager({ cells: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

describe('NotebookEditToggle', () => {
  const originalLocationService = locationService;

  beforeEach(() => {
    setLocationService(new HistoryWrapper(createMemoryHistory({ initialEntries: ['/notebooks/nb1'] })));
  });

  afterEach(() => {
    setLocationService(originalLocationService);
    jest.restoreAllMocks();
  });

  function setup({ canEdit }: { canEdit: boolean }) {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(canEdit);
    const notebook = buildScene();

    return { notebook, ...render(<NotebookEditToggle notebook={notebook} />) };
  }

  it('offers both modes to a user who can edit', () => {
    setup({ canEdit: true });

    expect(screen.getByRole('radio', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Edit' })).toBeInTheDocument();
  });

  it('hides the mode switch from a user who cannot edit', () => {
    setup({ canEdit: false });

    expect(screen.queryByRole('radio', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('puts the notebook into edit mode', async () => {
    const { notebook, user } = setup({ canEdit: true });

    await user.click(screen.getByRole('radio', { name: 'Edit' }));

    expect(notebook.state.isEditing).toBe(true);
  });

  it('takes it back out again', async () => {
    const { notebook, user } = setup({ canEdit: true });
    // act: the switch subscribes to the scene, so entering edit mode re-renders it.
    act(() => notebook.onEnterEditMode());

    await user.click(screen.getByRole('radio', { name: 'View' }));

    expect(notebook.state.isEditing).toBe(false);
  });

  it('reflects edit mode the scene is already in', () => {
    const { notebook } = setup({ canEdit: true });

    act(() => notebook.onEnterEditMode());

    expect(screen.getByRole('radio', { name: 'Edit' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'View' })).not.toBeChecked();
  });

  it('starts on view mode', () => {
    setup({ canEdit: true });

    expect(screen.getByRole('radio', { name: 'View' })).toBeChecked();
  });
});
