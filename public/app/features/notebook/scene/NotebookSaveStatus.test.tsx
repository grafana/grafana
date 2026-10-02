import { act, render, screen, userEvent } from 'test/test-utils';

import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';

import { NotebookSaveStatus } from './NotebookSaveStatus';
import { NotebookScene } from './NotebookScene';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

// A real scene and its real controller, never activated: these tests are about what the controller's
// state looks like on screen, so the state is set directly rather than driven through a save.
function buildAutosave() {
  const scene = new NotebookScene({
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

  return scene.autosave;
}

describe('NotebookSaveStatus', () => {
  it('says nothing about a notebook nobody has changed', () => {
    const autosave = buildAutosave();

    const { container } = render(<NotebookSaveStatus autosave={autosave} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['pending', 'Unsaved changes'],
    ['saved', 'Saved'],
    ['error', 'Save failed'],
  ] as const)('renders %s as "%s"', (status, label) => {
    const autosave = buildAutosave();
    autosave.setState({ status });

    render(<NotebookSaveStatus autosave={autosave} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  describe('while a save is in flight', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('goes on reporting unsaved changes while the save is too quick to be worth a word', () => {
      const autosave = buildAutosave();
      autosave.setState({ status: 'saving' });

      render(<NotebookSaveStatus autosave={autosave} />);

      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
    });

    it('says it is saving once the save has taken long enough to notice', () => {
      const autosave = buildAutosave();
      autosave.setState({ status: 'saving' });

      render(<NotebookSaveStatus autosave={autosave} />);
      act(() => jest.advanceTimersByTime(150));

      expect(screen.getByText('Saving…')).toBeInTheDocument();
    });
  });

  describe('once the save has landed', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('stops saying Saved after a couple of seconds', () => {
      const autosave = buildAutosave();
      autosave.setState({ status: 'saved' });

      render(<NotebookSaveStatus autosave={autosave} />);
      expect(screen.getByText('Saved')).toBeInTheDocument();

      act(() => jest.advanceTimersByTime(2000));

      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    });

    it('keeps a failure on screen, since it is still true', () => {
      const autosave = buildAutosave();
      autosave.setState({ status: 'error' });

      render(<NotebookSaveStatus autosave={autosave} />);

      act(() => jest.advanceTimersByTime(2000));

      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('offers a retry on failure, and asks the controller to try again', async () => {
    const autosave = buildAutosave();
    const retry = jest.spyOn(autosave, 'retry').mockImplementation(() => {});
    autosave.setState({ status: 'error' });

    render(<NotebookSaveStatus autosave={autosave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('offers no retry when there is nothing to retry', () => {
    const autosave = buildAutosave();
    autosave.setState({ status: 'saving' });

    render(<NotebookSaveStatus autosave={autosave} />);

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
