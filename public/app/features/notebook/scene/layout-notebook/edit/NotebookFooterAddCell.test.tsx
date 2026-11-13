import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { NotebookFooterAddCell } from './NotebookFooterAddCell';

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: jest.fn(),
}));

const mockUseQueryLibraryContext = useQueryLibraryContext as jest.Mock;
const moreOptions = { name: 'More visualization options' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQueryLibraryContext.mockReturnValue({ queryLibraryEnabled: true });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

describe('NotebookFooterAddCell', () => {
  it('adds a blank visualization from the main button', async () => {
    const onAdd = jest.fn();
    const { user } = render(<NotebookFooterAddCell onAdd={onAdd} onAddSavedQuery={jest.fn()} />);

    await user.click(screen.getByTestId(selectors.pages.Notebooks.Item.footerAddCellButton('visualization')));

    expect(onAdd).toHaveBeenCalledWith('visualization');
  });

  it('offers "New from Saved Queries" from the chevron menu', async () => {
    const onAdd = jest.fn();
    const onAddSavedQuery = jest.fn();
    const { user } = render(<NotebookFooterAddCell onAdd={onAdd} onAddSavedQuery={onAddSavedQuery} />);

    await user.click(screen.getByRole('button', moreOptions));
    await user.click(await screen.findByRole('menuitem', { name: 'New from Saved Queries' }));

    expect(onAddSavedQuery).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it.each([
    ['the query library is disabled', () => mockUseQueryLibraryContext.mockReturnValue({ queryLibraryEnabled: false })],
    ['the user lacks read permission', () => jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false)],
  ])('has no chevron menu when %s', (_, arrange) => {
    arrange();
    render(<NotebookFooterAddCell onAdd={jest.fn()} onAddSavedQuery={jest.fn()} />);

    expect(screen.queryByRole('button', moreOptions)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visualization' })).toBeInTheDocument();
  });

  it('has no chevron menu when no onAddSavedQuery is given', () => {
    render(<NotebookFooterAddCell onAdd={jest.fn()} />);

    expect(screen.queryByRole('button', moreOptions)).not.toBeInTheDocument();
  });
});
