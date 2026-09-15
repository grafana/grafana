import { render, screen } from '@testing-library/react';

import { DashboardScene } from '../DashboardScene';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { GroupSelectedActions } from './GroupSelectedActions';

describe('GroupSelectedActions', () => {
  it('renders both row and tab actions for a rows selection at the top level', () => {
    const r1 = new RowItem({ title: 'R1' });
    const r2 = new RowItem({ title: 'R2' });
    new DashboardScene({ body: new RowsLayoutManager({ rows: [r1, r2] }) });

    render(<GroupSelectedActions items={[r1, r2]} />);

    expect(screen.getByRole('button', { name: 'Group into row' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Group into tab' })).toBeEnabled();
  });

  it('shows the tab action disabled for a tabs selection', () => {
    const t1 = new TabItem({ title: 'T1' });
    const t2 = new TabItem({ title: 'T2' });
    new DashboardScene({ body: new TabsLayoutManager({ tabs: [t1, t2] }) });

    render(<GroupSelectedActions items={[t1, t2]} />);

    expect(screen.getByRole('button', { name: 'Group into row' })).toBeEnabled();
    // A disabled Button that carries a tooltip is rendered with aria-disabled (so the tooltip still works on hover).
    expect(screen.getByRole('button', { name: 'Group into tab' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables the tab action when the rows already live inside a tab', () => {
    const r1 = new RowItem({ title: 'R1' });
    const r2 = new RowItem({ title: 'R2' });
    const rows = new RowsLayoutManager({ rows: [r1, r2] });
    new DashboardScene({ body: new TabsLayoutManager({ tabs: [new TabItem({ title: 'T1', layout: rows })] }) });

    render(<GroupSelectedActions items={[r1, r2]} />);

    expect(screen.getByRole('button', { name: 'Group into row' })).toBeEnabled();
    // A disabled Button that carries a tooltip is rendered with aria-disabled (so the tooltip still works on hover).
    expect(screen.getByRole('button', { name: 'Group into tab' })).toHaveAttribute('aria-disabled', 'true');
  });
});
