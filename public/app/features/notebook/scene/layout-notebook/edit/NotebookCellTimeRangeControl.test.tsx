import { fireEvent, render, screen } from 'test/test-utils';

import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { Portal, PortalContainer } from '@grafana/ui';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { defaultVisualizationPanelKind } from 'app/features/notebook/types';

import { NotebookScene } from '../../NotebookScene';
import { NotebookCellItem } from '../NotebookCellItem';
import { NotebookLayoutManager } from '../NotebookLayoutManager';

import { NotebookCellTimeRangeControl } from './NotebookCellTimeRangeControl';

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
  it('shows a plain clock icon and no locked label when there is no override', () => {
    const cell = buildCell();
    render(<NotebookCellTimeRangeControl cell={cell} />);

    expect(screen.getByRole('button', { name: 'Update time range' })).toBeInTheDocument();
    expect(screen.queryByText(/Locked:/)).not.toBeInTheDocument();
  });

  it('shows the locked label and a clear button when the cell has its own range', () => {
    const cell = buildCell(new SceneTimeRange({ from: 'now-24h', to: 'now' }));
    render(<NotebookCellTimeRangeControl cell={cell} />);

    expect(screen.getByText('Locked: Last 24 hours')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync back to notebook time range' })).toBeInTheDocument();
  });

  it('opens the real time range picker content in one click, with no separate nested trigger', async () => {
    const cell = buildCell();
    const { user } = render(<NotebookCellTimeRangeControl cell={cell} />);

    await user.click(screen.getByRole('button', { name: 'Update time range' }));

    expect(await screen.findByRole('checkbox', { name: 'Last 5 minutes' })).toBeInTheDocument();
  });

  it('commits a picked quick range immediately, with no separate Apply step', async () => {
    const cell = buildCell();
    const { user } = render(<NotebookCellTimeRangeControl cell={cell} />);

    await user.click(screen.getByRole('button', { name: 'Update time range' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Last 5 minutes' }));

    expect(cell.state.$timeRange?.state.from).toBe('now-5m');
    expect(cell.state.$timeRange?.state.to).toBe('now');
    expect(screen.queryByRole('checkbox', { name: 'Last 5 minutes' })).not.toBeInTheDocument();
  });

  it('clears the override from the clear button directly, without opening the popover', async () => {
    const cell = buildCell(new SceneTimeRange({ from: 'now-24h', to: 'now' }));
    const { user } = render(<NotebookCellTimeRangeControl cell={cell} />);

    await user.click(screen.getByRole('button', { name: 'Sync back to notebook time range' }));

    expect(cell.state.$timeRange).toBeUndefined();
    expect(screen.queryByRole('checkbox', { name: /Last/ })).not.toBeInTheDocument();
  });

  it('closes the popover when the clear button is clicked while it is open', async () => {
    const cell = buildCell(new SceneTimeRange({ from: 'now-24h', to: 'now' }));
    const { user } = render(<NotebookCellTimeRangeControl cell={cell} />);

    await user.click(screen.getByRole('button', { name: 'Locked: Last 24 hours' }));
    expect(await screen.findByRole('checkbox', { name: 'Last 24 hours' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sync back to notebook time range' }));

    expect(cell.state.$timeRange).toBeUndefined();
    expect(screen.queryByRole('checkbox', { name: 'Last 24 hours' })).not.toBeInTheDocument();
  });

  it('closes on clicking the trigger again', async () => {
    const cell = buildCell();
    const { user } = render(<NotebookCellTimeRangeControl cell={cell} />);
    const openButton = screen.getByRole('button', { name: 'Update time range' });

    await user.click(openButton);
    expect(await screen.findByRole('checkbox', { name: 'Last 5 minutes' })).toBeInTheDocument();

    await user.click(openButton);
    expect(screen.queryByRole('checkbox', { name: 'Last 5 minutes' })).not.toBeInTheDocument();
  });

  it('closes when clicking outside the popover', async () => {
    const cell = buildCell();
    const { user } = render(
      <div>
        <PortalContainer />
        <NotebookCellTimeRangeControl cell={cell} />
        <button>Outside</button>
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Update time range' }));
    expect(await screen.findByRole('checkbox', { name: 'Last 5 minutes' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('checkbox', { name: 'Last 5 minutes' })).not.toBeInTheDocument();
  });

  it('does not close when clicking a portaled element, e.g. the calendar', async () => {
    const cell = buildCell();
    const { user, rerender } = render(
      <div>
        <PortalContainer />
        <NotebookCellTimeRangeControl cell={cell} />
      </div>
    );

    rerender(
      <div>
        <PortalContainer />
        <NotebookCellTimeRangeControl cell={cell} />
        <Portal>
          <button>Portaled calendar day</button>
        </Portal>
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Update time range' }));
    expect(await screen.findByRole('checkbox', { name: 'Last 5 minutes' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Portaled calendar day' }));

    expect(screen.getByRole('checkbox', { name: 'Last 5 minutes' })).toBeInTheDocument();
  });

  it('treats a click on the mobile backdrop as outside, closing the popover', async () => {
    const cell = buildCell();
    const { user } = render(
      <div>
        <PortalContainer />
        <NotebookCellTimeRangeControl cell={cell} />
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Update time range' }));
    expect(await screen.findByRole('checkbox', { name: 'Last 5 minutes' })).toBeInTheDocument();

    const backdrop = screen.getByTestId('notebook-cell-time-range-backdrop');
    fireEvent.mouseDown(backdrop);
    fireEvent.mouseUp(backdrop);
    fireEvent.click(backdrop);

    expect(screen.queryByRole('checkbox', { name: 'Last 5 minutes' })).not.toBeInTheDocument();
  });

  it('shows a tooltip explaining the button when there is no override', async () => {
    const cell = buildCell();
    const { user } = render(<NotebookCellTimeRangeControl cell={cell} />);

    await user.hover(screen.getByRole('button', { name: 'Update time range' }));

    expect(await screen.findByText('Lock panel time range')).toBeInTheDocument();
  });

  it('shows the resolved absolute range in the tooltip when the cell has its own range', async () => {
    const cell = buildCell(new SceneTimeRange({ from: 'now-24h', to: 'now' }));
    const { user } = render(<NotebookCellTimeRangeControl cell={cell} />);

    await user.hover(screen.getByText('Locked: Last 24 hours'));

    expect(await screen.findByText('to')).toBeInTheDocument();
    expect(screen.queryByText('Lock panel time range')).not.toBeInTheDocument();
  });
});
