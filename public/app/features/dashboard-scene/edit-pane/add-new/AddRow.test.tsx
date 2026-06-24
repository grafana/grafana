import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { useNestingRestrictions } from '../../scene/layouts-shared/CanvasGridAddActions';
import { addNewRowTo } from '../../scene/layouts-shared/addNew';

import { AddRow } from './AddRow';

jest.mock('../../scene/layouts-shared/addNew', () => ({
  ...jest.requireActual('../../scene/layouts-shared/addNew'),
  addNewRowTo: jest.fn(),
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

const mockedAddNewRowTo = jest.mocked(addNewRowTo);
const mockedUseNestingRestrictions = jest.mocked(useNestingRestrictions);

describe('AddRow', () => {
  beforeEach(() => {
    mockedAddNewRowTo.mockReset();
    mockedUseNestingRestrictions.mockReset();
  });

  it('shows "Group into rows" label when layout is not rows', () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const layout = AutoGridLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;

    render(<AddRow dashboardScene={dashboardScene} selectedElement={undefined} />);

    expect(screen.getByRole('button', { name: 'Group into rows' })).toBeEnabled();
  });

  it('shows "Add row" label when layout is rows', () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const layout = RowsLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;

    render(<AddRow dashboardScene={dashboardScene} selectedElement={undefined} />);

    expect(screen.getByRole('button', { name: 'Add row' })).toBeEnabled();
  });

  it('disables row action at max nesting depth and shows tooltip', () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: true, disableTabs: true });
    const layout = AutoGridLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;

    render(<AddRow dashboardScene={dashboardScene} selectedElement={undefined} />);

    const button = screen.getByRole('button', { name: 'Group into rows' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-tooltip', 'Grouping is limited to 3 levels');
  });

  it('adds a row when enabled', async () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const layout = AutoGridLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;
    const user = userEvent.setup();

    render(<AddRow dashboardScene={dashboardScene} selectedElement={undefined} />);

    await user.click(screen.getByRole('button', { name: 'Group into rows' }));

    expect(mockedAddNewRowTo).toHaveBeenCalledTimes(1);
    expect(mockedAddNewRowTo).toHaveBeenCalledWith(layout);
  });

  it('targets selected row layout when a row is selected', async () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const rootLayout = AutoGridLayoutManager.createEmpty();
    const rowInnerLayout = AutoGridLayoutManager.createEmpty();
    const selectedRow = new RowItem({ layout: rowInnerLayout });
    const dashboardScene = { getLayout: () => rootLayout } as never;
    const user = userEvent.setup();

    render(<AddRow dashboardScene={dashboardScene} selectedElement={selectedRow} />);

    await user.click(screen.getByRole('button', { name: 'Group into rows' }));

    expect(mockedAddNewRowTo).toHaveBeenCalledTimes(1);
    expect(mockedAddNewRowTo).toHaveBeenCalledWith(rowInnerLayout);
  });

  it('targets selected tab layout when a tab is selected', async () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const rootLayout = AutoGridLayoutManager.createEmpty();
    const tabInnerLayout = AutoGridLayoutManager.createEmpty();
    const selectedTab = new TabItem({ layout: tabInnerLayout });
    const dashboardScene = { getLayout: () => rootLayout } as never;
    const user = userEvent.setup();

    render(<AddRow dashboardScene={dashboardScene} selectedElement={selectedTab} />);

    await user.click(screen.getByRole('button', { name: 'Group into rows' }));

    expect(mockedAddNewRowTo).toHaveBeenCalledTimes(1);
    expect(mockedAddNewRowTo).toHaveBeenCalledWith(tabInnerLayout);
  });
});
