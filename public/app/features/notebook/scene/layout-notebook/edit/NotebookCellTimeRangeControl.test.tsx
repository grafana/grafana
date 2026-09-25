import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { defaultVisualizationPanelKind } from 'app/features/notebook/types';

import { NotebookScene } from '../../NotebookScene';
import { NotebookCellItem } from '../NotebookCellItem';
import { NotebookLayoutManager } from '../NotebookLayoutManager';

import { NotebookCellTimeRangeControl } from './NotebookCellTimeRangeControl';

// A cell needs a notebook scene above it for sceneGraph.getTimeRange to resolve an ambient range
// (the "use notebook time" preview) — no activation required, only the parent chain that
// SceneObjectBase wires synchronously on construction, same setup as PanelQueryEditor.test.tsx.
function buildCell(timeRange?: SceneTimeRange) {
  const panel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 1));
  const cell = new NotebookCellItem({ elementName: 'panel-1', source: 'user', body: panel, $timeRange: timeRange });
  new NotebookScene({
    title: 'Test notebook',
    body: new NotebookLayoutManager({ cells: [cell] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
  return cell;
}

describe('NotebookCellTimeRangeControl', () => {
  it('reverts a from/to change made since opening the popover, on Reset', async () => {
    const cell = buildCell(new SceneTimeRange({ from: 'now-24h', to: 'now' }));
    const { user } = render(<NotebookCellTimeRangeControl cell={cell} />);

    await user.click(screen.getByRole('button'));
    // Testid, not accessible name: SceneTimePicker always computes a duration-specific tooltip
    // ("Move 12h backward"), unlike TimeRangePicker's own static default text.
    await user.click(screen.getByTestId(selectors.components.TimePicker.moveBackwardButton));

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    // The real assertion that matters: Reset discarded the mid-session move, so Apply persists the
    // committed range, not the shifted one.
    expect(cell.state.$timeRange?.state.from).toBe('now-24h');
    expect(cell.state.$timeRange?.state.to).toBe('now');
  });
});
