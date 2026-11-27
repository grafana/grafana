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

  const modeButton = () => screen.getByRole('button', { name: /^Notebook mode:/ });

  it('offers both modes in one dropdown to a user who can edit', async () => {
    const { user } = setup({ canEdit: true });

    await user.click(modeButton());

    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'ViewingView and explore the notebook.',
      'EditingEdit text and panels.',
    ]);
  });

  it('hides the mode picker from a user who cannot edit', () => {
    setup({ canEdit: false });

    expect(screen.queryByRole('button', { name: /^Notebook mode:/ })).not.toBeInTheDocument();
  });

  it('puts the notebook into edit mode', async () => {
    const { notebook, user } = setup({ canEdit: true });

    await user.click(modeButton());
    await user.click(screen.getByRole('menuitemradio', { name: /Editing/ }));

    expect(notebook.state.isEditing).toBe(true);
    expect(modeButton()).toHaveAccessibleName('Notebook mode: Editing');
  });

  it('takes it back out again', async () => {
    const { notebook, user } = setup({ canEdit: true });
    // act: the picker subscribes to the scene, so entering edit mode re-renders it.
    act(() => notebook.onEnterEditMode());

    await user.click(modeButton());
    await user.click(screen.getByRole('menuitemradio', { name: /Viewing/ }));

    expect(notebook.state.isEditing).toBe(false);
  });

  it('does not restart editing when Editing is chosen again', async () => {
    const { notebook, user } = setup({ canEdit: true });
    act(() => notebook.onEnterEditMode());
    const enter = jest.spyOn(notebook, 'onEnterEditMode');

    await user.click(modeButton());
    await user.click(screen.getByRole('menuitemradio', { name: /Editing/ }));

    expect(enter).not.toHaveBeenCalled();
    expect(notebook.state.isEditing).toBe(true);
  });

  it('reflects edit mode the scene is already in', async () => {
    const { notebook, user } = setup({ canEdit: true });

    act(() => notebook.onEnterEditMode());
    expect(modeButton()).toHaveAccessibleName('Notebook mode: Editing');
    await user.click(modeButton());

    expect(screen.getByRole('menuitemradio', { name: /Editing/ })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: /Viewing/ })).not.toBeChecked();
  });

  it('starts on view mode', () => {
    setup({ canEdit: true });

    expect(modeButton()).toHaveAccessibleName('Notebook mode: Viewing');
  });
});
