import { screen } from '@testing-library/react';

import { Menu } from '@grafana/ui';

import { trackAddQuery } from '../../tracking';
import { dashboardDsSettingsMock, renderWithQueryEditorProvider } from '../testUtils';

import { AddQueryMenuItems } from './AddQueryMenuItems';

const mockQueryLibrary = { openDrawer: jest.fn(), queryLibraryEnabled: true };

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => mockQueryLibrary,
}));

jest.mock('app/features/explore/QueryLibrary/utils/identity', () => ({
  hasSavedQueryReadPermissions: () => true,
}));

jest.mock('../../tracking', () => ({
  ...jest.requireActual('../../tracking'),
  trackAddQuery: jest.fn(),
}));

function renderMenu(
  props: Partial<Parameters<typeof AddQueryMenuItems>[0]> = {},
  options: Parameters<typeof renderWithQueryEditorProvider>[1] = {}
) {
  return renderWithQueryEditorProvider(
    <Menu>
      <AddQueryMenuItems afterId="A" {...props} />
    </Menu>,
    options
  );
}

describe('AddQueryMenuItems', () => {
  beforeEach(() => {
    mockQueryLibrary.queryLibraryEnabled = true;
  });

  it('lists add query, saved query, then expression', () => {
    renderMenu();

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Add query',
      'Add saved query',
      'Add expression',
    ]);
  });

  it('hides add saved query when the query library is disabled', () => {
    mockQueryLibrary.queryLibraryEnabled = false;
    renderMenu();

    expect(screen.queryByRole('menuitem', { name: 'Add saved query' })).not.toBeInTheDocument();
  });

  it('inserts a new query after the card and selects it', async () => {
    const addQuery = jest.fn().mockReturnValue('C');
    const setSelectedQuery = jest.fn();
    const { user } = renderMenu({}, { actionsOverrides: { addQuery }, uiStateOverrides: { setSelectedQuery } });

    await user.click(screen.getByRole('menuitem', { name: 'Add query' }));

    expect(addQuery).toHaveBeenCalledWith(undefined, 'A');
    expect(setSelectedQuery).toHaveBeenCalledWith({ refId: 'C', hide: false });
  });

  it('tracks with the given source instead of the default', async () => {
    const { user } = renderMenu({ source: 'stacked_gap' }, { actionsOverrides: { addQuery: jest.fn() } });

    await user.click(screen.getByRole('menuitem', { name: 'Add query' }));

    expect(trackAddQuery).toHaveBeenCalledWith('new_query', 'stacked_gap');
  });

  it('opens the expression picker after the card', async () => {
    const setPendingExpression = jest.fn();
    const { user } = renderMenu({}, { uiStateOverrides: { setPendingExpression } });

    await user.click(screen.getByRole('menuitem', { name: 'Add expression' }));

    expect(setPendingExpression).toHaveBeenCalledWith({ insertAfter: 'A' });
  });

  it('disables add expression for the dashboard data source', async () => {
    const setPendingExpression = jest.fn();
    const { user } = renderMenu(
      {},
      { dsState: { dsSettings: dashboardDsSettingsMock }, uiStateOverrides: { setPendingExpression } }
    );

    const addExpression = screen.getByRole('menuitem', { name: 'Add expression' });
    expect(addExpression).toBeDisabled();

    await user.click(addExpression);
    expect(setPendingExpression).not.toHaveBeenCalled();
  });
});
