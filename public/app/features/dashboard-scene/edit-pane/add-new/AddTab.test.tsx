import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { useNestingRestrictions } from '../../scene/layouts-shared/CanvasGridAddActions';
import { addNewTabTo } from '../../scene/layouts-shared/addNew';

import { AddTab } from './AddTab';

jest.mock('../../scene/layouts-shared/addNew', () => ({
  ...jest.requireActual('../../scene/layouts-shared/addNew'),
  addNewTabTo: jest.fn(),
}));

jest.mock('../../scene/layouts-shared/CanvasGridAddActions', () => ({
  ...jest.requireActual('../../scene/layouts-shared/CanvasGridAddActions'),
  useNestingRestrictions: jest.fn(),
}));

jest.mock('./AddButton', () => ({
  AddButton: ({
    label,
    onClick,
    disabled,
    tooltip,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tooltip?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-tooltip={tooltip}>
      {label}
    </button>
  ),
}));

const mockedAddNewTabTo = jest.mocked(addNewTabTo);
const mockedUseNestingRestrictions = jest.mocked(useNestingRestrictions);

describe('AddTab', () => {
  beforeEach(() => {
    mockedAddNewTabTo.mockReset();
    mockedUseNestingRestrictions.mockReset();
  });

  it('shows "Group into tabs" label when layout is not tabs', () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const layout = AutoGridLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;

    render(<AddTab dashboardScene={dashboardScene} selectedElement={undefined} />);

    expect(screen.getByRole('button', { name: 'Group into tabs' })).toBeEnabled();
  });

  it('shows "Add tab" label when layout is tabs', () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const layout = TabsLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;

    render(<AddTab dashboardScene={dashboardScene} selectedElement={undefined} />);

    expect(screen.getByRole('button', { name: 'Add tab' })).toBeEnabled();
  });

  it('shows nested-tabs tooltip when disabled by tab nesting', () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: true });
    const layout = AutoGridLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;

    render(<AddTab dashboardScene={dashboardScene} selectedElement={undefined} />);

    const button = screen.getByRole('button', { name: 'Group into tabs' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-tooltip', 'Tabs cannot be nested inside other tabs');
  });

  it('shows grouping-limit tooltip when disabled by max depth', () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: true, disableTabs: true });
    const layout = AutoGridLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;

    render(<AddTab dashboardScene={dashboardScene} selectedElement={undefined} />);

    const button = screen.getByRole('button', { name: 'Group into tabs' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-tooltip', 'Grouping is limited to 3 levels');
  });

  it('adds a tab when enabled', async () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const layout = AutoGridLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;
    const user = userEvent.setup();

    render(<AddTab dashboardScene={dashboardScene} selectedElement={undefined} />);

    await user.click(screen.getByRole('button', { name: 'Group into tabs' }));

    expect(mockedAddNewTabTo).toHaveBeenCalledTimes(1);
    expect(mockedAddNewTabTo).toHaveBeenCalledWith(layout);
  });

  it('targets selected row layout when a row is selected', async () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const rootLayout = AutoGridLayoutManager.createEmpty();
    const rowInnerLayout = AutoGridLayoutManager.createEmpty();
    const selectedRow = new RowItem({ layout: rowInnerLayout });
    const dashboardScene = { getLayout: () => rootLayout } as never;
    const user = userEvent.setup();

    render(<AddTab dashboardScene={dashboardScene} selectedElement={selectedRow} />);

    await user.click(screen.getByRole('button', { name: 'Group into tabs' }));

    expect(mockedAddNewTabTo).toHaveBeenCalledTimes(1);
    expect(mockedAddNewTabTo).toHaveBeenCalledWith(rowInnerLayout);
  });
});
