import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
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

  it('disables row action at max nesting depth and shows tooltip', () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: true, disableTabs: true });
    const layout = AutoGridLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;

    render(<AddRow dashboardScene={dashboardScene} selectedElement={undefined} />);

    const button = screen.getByRole('button', { name: 'Rows' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-tooltip', 'Grouping is limited to 3 levels');
  });

  it('adds a row when enabled', async () => {
    mockedUseNestingRestrictions.mockReturnValue({ disableGrouping: false, disableTabs: false });
    const layout = AutoGridLayoutManager.createEmpty();
    const dashboardScene = { getLayout: () => layout } as never;
    const user = userEvent.setup();

    render(<AddRow dashboardScene={dashboardScene} selectedElement={undefined} />);

    await user.click(screen.getByRole('button', { name: 'Rows' }));

    expect(mockedAddNewRowTo).toHaveBeenCalledTimes(1);
    expect(mockedAddNewRowTo).toHaveBeenCalledWith(layout);
  });
});
