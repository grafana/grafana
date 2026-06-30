import { act, screen } from '@testing-library/react';
import { render, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { SceneTimeRange } from '@grafana/scenes';

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

function renderRow({ collapse = false, title = 'My row' } = {}) {
  const row = new RowItem({
    key: 'row-1',
    title,
    collapse,
    layout: AutoGridLayoutManager.createEmpty(),
  });
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: new RowsLayoutManager({ rows: [row] }),
  });
  render(<scene.Component model={scene} />);
  return { row };
}

describe('RowItemRenderer', () => {
  it('exposes aria-expanded=true on the toggle button when the row is expanded', () => {
    const { row } = renderRow({ collapse: false });

    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('exposes aria-expanded=false on the toggle button when the row is collapsed', () => {
    const { row } = renderRow({ collapse: true });

    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('updates aria-expanded when the row is toggled', async () => {
    const { row } = renderRow({ collapse: false });
    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps a conditionally hidden row mounted but visually hidden so dnd indices stay contiguous', () => {
    const conditionalRendering = new ConditionalRenderingGroup({
      condition: 'and',
      visibility: 'show',
      conditions: [],
      result: true,
      renderHidden: false,
    });
    const row = new RowItem({
      key: 'row-1',
      title: 'My row',
      layout: AutoGridLayoutManager.createEmpty(),
      conditionalRendering,
    });
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: new RowsLayoutManager({ rows: [row] }),
    });
    const { container } = render(<scene.Component model={scene} />);

    expect(screen.getByTestId(selectors.components.DashboardRow.wrapper(row.state.title!))).toBeInTheDocument();

    act(() => {
      conditionalRendering.setState({ result: false });
    });

    // The row header/content is gone, but a placeholder element stays in the DOM hidden via display: none
    expect(screen.queryByTestId(selectors.components.DashboardRow.wrapper(row.state.title!))).not.toBeInTheDocument();
    expect(container.querySelector('[data-rfd-draggable-id="row-1"]')).toHaveStyle({ display: 'none' });
  });
});
