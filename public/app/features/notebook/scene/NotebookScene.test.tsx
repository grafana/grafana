import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';

import { NotebookScene } from './NotebookScene';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

function buildScene(hideTimeControls: boolean) {
  return new NotebookScene({
    title: 'My notebook',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'md1',
          source: 'assistant',
          content: { kind: 'Markdown', spec: { text: 'Hello' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({ refresh: '10s', intervals: ['10s', '1m'] }),
    hideTimeControls,
  });
}

describe('NotebookScene', () => {
  // activate() only propagates to $timeRange/$variables/$data/$behaviors; the pickers are plain
  // state and are otherwise activated by their renderers. With the controls row hidden nothing
  // renders the refresh picker, so without an explicit activation its interval never starts and the
  // spec's autoRefresh silently does nothing.
  it('activates the refresh picker when the time controls are hidden', () => {
    const scene = buildScene(true);

    const deactivate = scene.activate();

    expect(scene.state.refreshPicker.isActive).toBe(true);

    deactivate();
    expect(scene.state.refreshPicker.isActive).toBe(false);
  });

  it('leaves the refresh picker to its renderer when the time controls are shown', () => {
    const scene = buildScene(false);

    scene.activate();

    expect(scene.state.refreshPicker.isActive).toBe(false);
  });
});
