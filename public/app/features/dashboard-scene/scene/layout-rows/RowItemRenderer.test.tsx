import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { SceneTimeRange } from '@grafana/scenes';

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

  it('updates aria-expanded when the row is toggled', () => {
    const { row } = renderRow({ collapse: false });
    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      row.onCollapseToggle();
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      row.onCollapseToggle();
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
