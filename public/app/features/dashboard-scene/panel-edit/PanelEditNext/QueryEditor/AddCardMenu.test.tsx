import { screen } from '@testing-library/react';

import { AddCardMenu } from './AddCardMenu';
import { dashboardDsSettingsMock, renderWithQueryEditorProvider } from './testUtils';

const mockQueryLibrary = { openDrawer: jest.fn(), queryLibraryEnabled: true };

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => mockQueryLibrary,
}));

jest.mock('app/features/explore/QueryLibrary/utils/identity', () => ({
  hasSavedQueryReadPermissions: () => true,
}));

function renderMenu(
  props: Partial<Parameters<typeof AddCardMenu>[0]> = {},
  options: Parameters<typeof renderWithQueryEditorProvider>[1] = {}
) {
  return renderWithQueryEditorProvider(<AddCardMenu afterId="A" source="stacked_gap" {...props} />, options);
}

describe('AddCardMenu', () => {
  beforeEach(() => {
    mockQueryLibrary.queryLibraryEnabled = true;
  });

  it('lists add query, saved query, expression, then transformation', () => {
    renderMenu({ showAddTransformation: true });

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Add query',
      'Add saved query',
      'Add expression',
      'Add transformation',
    ]);
  });

  it('hides add saved query when the query library is disabled', () => {
    mockQueryLibrary.queryLibraryEnabled = false;
    renderMenu();

    expect(screen.queryByRole('menuitem', { name: 'Add saved query' })).not.toBeInTheDocument();
  });

  it('omits add transformation unless asked', () => {
    renderMenu();

    expect(screen.queryByRole('menuitem', { name: 'Add transformation' })).not.toBeInTheDocument();
  });

  it('inserts a new query after the card and selects it', async () => {
    const addQuery = jest.fn().mockReturnValue('C');
    const setSelectedQuery = jest.fn();
    const { user } = renderMenu({}, { actionsOverrides: { addQuery }, uiStateOverrides: { setSelectedQuery } });

    await user.click(screen.getByRole('menuitem', { name: 'Add query' }));

    expect(addQuery).toHaveBeenCalledWith(undefined, 'A');
    expect(setSelectedQuery).toHaveBeenCalledWith({ refId: 'C', hide: false });
  });

  it('opens the expression picker after the card', async () => {
    const setPendingExpression = jest.fn();
    const { user } = renderMenu({}, { uiStateOverrides: { setPendingExpression } });

    await user.click(screen.getByRole('menuitem', { name: 'Add expression' }));

    expect(setPendingExpression).toHaveBeenCalledWith({ insertAfter: 'A' });
  });

  it('appends a transformation to the end of the list', async () => {
    const setPendingTransformation = jest.fn();
    const { user } = renderMenu({ showAddTransformation: true }, { uiStateOverrides: { setPendingTransformation } });

    await user.click(screen.getByRole('menuitem', { name: 'Add transformation' }));

    expect(setPendingTransformation).toHaveBeenCalledWith({ insertAfter: undefined });
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
