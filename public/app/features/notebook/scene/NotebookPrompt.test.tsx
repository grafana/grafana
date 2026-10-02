import { createMemoryHistory, type History, type Location } from 'history';
import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { ModalRoot } from '@grafana/ui';

import { NotebookPrompt, needsConfirmBeforeLeaving } from './NotebookPrompt';
import { NotebookScene } from './NotebookScene';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: jest.fn(),
    getHistory: jest.fn(),
    push: jest.fn(),
  },
}));

// A real scene and its real autosave controller, never activated: these tests set state directly
// rather than driving it through an actual save (see NotebookSaveStatus.test.tsx for the same approach).
function buildScene() {
  return new NotebookScene({
    uid: 'nb-1',
    title: 'My notebook',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'md1',
          source: 'user',
          content: { kind: 'Markdown', spec: { text: 'Hello' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({ refresh: '', intervals: ['10s'] }),
  });
}

describe('needsConfirmBeforeLeaving', () => {
  it('is false for a reader, regardless of autosave status', () => {
    const scene = buildScene();
    scene.autosave.setState({ status: 'saving' });

    expect(needsConfirmBeforeLeaving(scene)).toBe(false);
  });

  it.each(['idle', 'saved'] as const)('is false while editing once autosave has settled on %s', (status) => {
    const scene = buildScene();
    scene.setState({ isEditing: true });
    scene.autosave.setState({ status });

    expect(needsConfirmBeforeLeaving(scene)).toBe(false);
  });

  it.each(['pending', 'saving', 'error'] as const)('is true while editing with autosave status %s', (status) => {
    const scene = buildScene();
    scene.setState({ isEditing: true });
    scene.autosave.setState({ status });

    expect(needsConfirmBeforeLeaving(scene)).toBe(true);
  });
});

describe('NotebookPrompt', () => {
  let mockHistory: History & { block: jest.Mock };

  beforeEach(() => {
    const historyInstance = createMemoryHistory({ initialEntries: ['/notebooks/nb-1'] });
    mockHistory = { ...historyInstance, block: jest.fn(() => jest.fn()) };

    jest.mocked(locationService.getLocation).mockReturnValue({ pathname: '/notebooks/nb-1' } as Location);
    jest.mocked(locationService.getHistory).mockReturnValue(mockHistory);
    jest.mocked(locationService.push).mockClear();
  });

  function renderPrompt(scene: NotebookScene) {
    return render(
      <>
        <NotebookPrompt scene={scene} />
        <ModalRoot />
      </>
    );
  }

  function block(location: Partial<Location> = {}) {
    const message = mockHistory.block.mock.calls[0][0];
    let result: ReturnType<typeof message>;
    act(() => {
      result = message({ pathname: '/elsewhere', search: '', hash: '', state: undefined, ...location });
    });
    return result;
  }

  it('allows navigation within the same notebook without asking anything', () => {
    const scene = buildScene();
    scene.setState({ isEditing: true });
    scene.autosave.setState({ status: 'saving' });
    renderPrompt(scene);

    expect(block({ pathname: '/notebooks/nb-1' })).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('allows navigation away once autosave has settled', () => {
    const scene = buildScene();
    scene.setState({ isEditing: true });
    scene.autosave.setState({ status: 'saved' });
    renderPrompt(scene);

    expect(block()).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks navigation and warns while autosave is still writing', () => {
    const scene = buildScene();
    scene.setState({ isEditing: true });
    scene.autosave.setState({ status: 'saving' });
    renderPrompt(scene);

    expect(block()).toBe(false);
    expect(screen.getByText('This notebook is still saving')).toBeInTheDocument();
  });

  it('warns with conflict-specific wording once autosave has failed on a conflict', () => {
    const scene = buildScene();
    scene.setState({ isEditing: true });
    scene.autosave.setState({ status: 'error', isConflict: true });
    renderPrompt(scene);

    expect(block()).toBe(false);
    expect(screen.getByText('Someone else has updated this notebook')).toBeInTheDocument();
  });

  it('navigates away once the user confirms leaving', async () => {
    const scene = buildScene();
    scene.setState({ isEditing: true });
    scene.autosave.setState({ status: 'saving' });
    renderPrompt(scene);
    block();

    await userEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));

    expect(screen.queryByText('This notebook is still saving')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(locationService.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/elsewhere' }))
    );
  });

  it('stays on the notebook and keeps nothing pending when the user dismisses', async () => {
    const scene = buildScene();
    scene.setState({ isEditing: true });
    scene.autosave.setState({ status: 'saving' });
    renderPrompt(scene);
    block();

    await userEvent.click(screen.getByRole('button', { name: 'Stay' }));

    expect(screen.queryByText('This notebook is still saving')).not.toBeInTheDocument();
    expect(locationService.push).not.toHaveBeenCalled();
  });
});
