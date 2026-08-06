import { screen } from '@testing-library/react';
import { render, userEvent } from 'test/test-utils';

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

  it('updates aria-expanded when the row is toggled', async () => {
    const { row } = renderRow({ collapse: false });
    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('copies a link to the row when the copy link button is clicked', async () => {
    // ClipboardButton only uses the clipboard API in a secure context.
    // userEvent.setup() (called by render) attaches a working clipboard stub we can read back.
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    renderRow({ title: 'My row' });

    await userEvent.click(screen.getByRole('button', { name: 'Copy link to row' }));

    expect(await navigator.clipboard.readText()).toContain('srow=My-row');
  });

  it('copies a link with the full slug path for a nested row', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    const nestedRow = new RowItem({ title: 'Row 1', layout: AutoGridLayoutManager.createEmpty() });
    const outerRow = new RowItem({ title: 'Row 2', layout: new RowsLayoutManager({ rows: [nestedRow] }) });
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: new RowsLayoutManager({ rows: [outerRow] }),
    });
    render(<scene.Component model={scene} />);

    const copyButtons = screen.getAllByRole('button', { name: 'Copy link to row' });
    expect(copyButtons).toHaveLength(2);

    // The outer row's header renders before the nested row's header
    await userEvent.click(copyButtons[1]);

    const copiedUrl = new URL(await navigator.clipboard.readText());
    expect(copiedUrl.searchParams.get('srow')).toBe('Row-2/Row-1');
  });
});
