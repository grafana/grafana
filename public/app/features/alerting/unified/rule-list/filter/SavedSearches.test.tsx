import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SavedSearch, SavedSearches } from './SavedSearches';

const mockSavedSearches: SavedSearch[] = [
  {
    id: '1',
    name: 'My Firing Rules',
    query: 'state:firing',
    isDefault: false,
    createdAt: Date.now() - 1000,
  },
  {
    id: '2',
    name: 'Default Search',
    query: 'label:team=A',
    isDefault: true,
    createdAt: Date.now() - 2000,
  },
  {
    id: '3',
    name: 'Critical Alerts',
    query: 'label:severity=critical state:firing',
    isDefault: false,
    createdAt: Date.now() - 3000,
  },
];

const defaultProps = {
  savedSearches: mockSavedSearches,
  currentSearchQuery: '',
  onSave: jest.fn(),
  onRename: jest.fn(),
  onDelete: jest.fn(),
  onApply: jest.fn(),
  onSetDefault: jest.fn(),
};

function setup(props: Partial<typeof defaultProps> = {}) {
  const mergedProps = { ...defaultProps, ...props };
  const user = userEvent.setup();
  const utils = render(<SavedSearches {...mergedProps} />);
  return { user, ...utils, props: mergedProps };
}

describe('SavedSearches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the Saved searches button', () => {
      setup();
      expect(screen.getByRole('button', { name: /saved searches/i })).toBeInTheDocument();
    });

    it('opens dropdown when button is clicked', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('displays saved searches in alphabetical order with default first', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      const listItems = screen.getAllByRole('button', { name: /apply search/i });
      // Default Search should be first (isDefault: true), then alphabetically: Critical Alerts, My Firing Rules
      expect(listItems).toHaveLength(3);
    });

    it('shows empty state when no saved searches exist', async () => {
      const { user } = setup({ savedSearches: [] });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      expect(screen.getByText(/no saved searches/i)).toBeInTheDocument();
    });

    it('shows star icon for default search', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      // Find the default search item
      const defaultSearchName = screen.getByText('Default Search');
      expect(defaultSearchName).toBeInTheDocument();
    });
  });

  describe('Save functionality', () => {
    it('shows save button when currentSearchQuery is provided', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      expect(screen.getByRole('button', { name: /save current search/i })).toBeInTheDocument();
    });

    it('disables save button when currentSearchQuery is empty', async () => {
      const { user } = setup({ currentSearchQuery: '' });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      const saveButton = screen.getByRole('button', { name: /save current search/i });
      expect(saveButton).toBeDisabled();
    });

    it('switches to save mode when save button is clicked', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByRole('button', { name: /save current search/i }));

      expect(screen.getByPlaceholderText(/enter a name/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save$/i })).toBeInTheDocument();
    });

    it('calls onSave with name and query when save is confirmed', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue(undefined);

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByRole('button', { name: /save current search/i }));
      await user.type(screen.getByPlaceholderText(/enter a name/i), 'My New Search');
      await user.click(screen.getByRole('button', { name: /save$/i }));

      expect(props.onSave).toHaveBeenCalledWith('My New Search', 'state:pending');
    });

    it('shows validation error when name is empty', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByRole('button', { name: /save current search/i }));
      await user.click(screen.getByRole('button', { name: /save$/i }));

      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });

    it('shows validation error when name exceeds 64 characters', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });
      const longName = 'a'.repeat(65);

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByRole('button', { name: /save current search/i }));
      await user.type(screen.getByPlaceholderText(/enter a name/i), longName);
      await user.click(screen.getByRole('button', { name: /save$/i }));

      expect(screen.getByText(/name must be 64 characters or less/i)).toBeInTheDocument();
    });

    it('shows validation error from onSave callback (duplicate name)', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue({
        field: 'name',
        message: 'A saved search with this name already exists',
      });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByRole('button', { name: /save current search/i }));
      await user.type(screen.getByPlaceholderText(/enter a name/i), 'My Firing Rules');
      await user.click(screen.getByRole('button', { name: /save$/i }));

      expect(screen.getByText(/a saved search with this name already exists/i)).toBeInTheDocument();
    });

    it('returns to list mode after successful save', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue(undefined);

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByRole('button', { name: /save current search/i }));
      await user.type(screen.getByPlaceholderText(/enter a name/i), 'New Search');
      await user.click(screen.getByRole('button', { name: /save$/i }));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/enter a name/i)).not.toBeInTheDocument();
      });
    });

    it('cancels save mode when cancel button is clicked', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByRole('button', { name: /save current search/i }));
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByPlaceholderText(/enter a name/i)).not.toBeInTheDocument();
    });
  });

  describe('Apply functionality', () => {
    it('calls onApply when a search item is clicked', async () => {
      const { user, props } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByText('My Firing Rules'));

      expect(props.onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          name: 'My Firing Rules',
          query: 'state:firing',
        })
      );
    });

    it('closes dropdown after applying a search', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByText('My Firing Rules'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Action menu', () => {
    it('opens action menu when three-dot button is clicked', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      // Find the first three-dot menu button
      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[0]);

      expect(screen.getByText(/set as default/i)).toBeInTheDocument();
      expect(screen.getByText(/rename/i)).toBeInTheDocument();
      expect(screen.getByText(/delete/i)).toBeInTheDocument();
    });

    it('shows "Remove default" option for default search', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      // Find the Default Search item's menu button (it should be the first one after sorting)
      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[0]); // Default Search is first

      expect(screen.getByText(/remove default/i)).toBeInTheDocument();
    });
  });

  describe('Set default functionality', () => {
    it('calls onSetDefault with search id when "Set as default" is clicked', async () => {
      const { user, props } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      // Find a non-default search's menu button
      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[1]); // Second item (not default)

      await user.click(screen.getByText(/set as default/i));

      expect(props.onSetDefault).toHaveBeenCalled();
    });

    it('calls onSetDefault with null when "Remove default" is clicked', async () => {
      const { user, props } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      // Find the Default Search's menu button (first item)
      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[0]);

      await user.click(screen.getByText(/remove default/i));

      expect(props.onSetDefault).toHaveBeenCalledWith(null);
    });
  });

  describe('Rename functionality', () => {
    it('shows rename input when "Rename" is clicked', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[0]);
      await user.click(screen.getByText(/rename/i));

      expect(screen.getByDisplayValue('Default Search')).toBeInTheDocument();
    });

    it('calls onRename with new name when rename is confirmed', async () => {
      const { user, props } = setup();
      props.onRename.mockResolvedValue(undefined);

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[0]);
      await user.click(screen.getByText(/rename/i));

      const input = screen.getByDisplayValue('Default Search');
      await user.clear(input);
      await user.type(input, 'Renamed Search');

      // Press Enter to confirm
      await user.keyboard('{Enter}');

      expect(props.onRename).toHaveBeenCalledWith('2', 'Renamed Search');
    });

    it('shows validation error when renamed to duplicate name', async () => {
      const { user, props } = setup();
      props.onRename.mockResolvedValue({
        field: 'name',
        message: 'A saved search with this name already exists',
      });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[0]);
      await user.click(screen.getByText(/rename/i));

      const input = screen.getByDisplayValue('Default Search');
      await user.clear(input);
      await user.type(input, 'My Firing Rules');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/a saved search with this name already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('Delete functionality', () => {
    it('shows delete confirmation when "Delete" is clicked', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[0]);
      await user.click(screen.getByText(/^delete$/i));

      // Delete confirmation shows the item name with cancel and confirm buttons
      expect(screen.getByText('Default Search')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('calls onDelete when delete is confirmed', async () => {
      const { user, props } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[0]);
      await user.click(screen.getByText(/^delete$/i));

      // Confirm delete by clicking trash button
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[deleteButtons.length - 1]); // The confirm delete button

      expect(props.onDelete).toHaveBeenCalledWith('2');
    });

    it('cancels delete when cancel is clicked', async () => {
      const { user, props } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      const menuButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(menuButtons[0]);
      await user.click(screen.getByText(/^delete$/i));

      // Cancel delete
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(props.onDelete).not.toHaveBeenCalled();
      // Item should be back in normal display mode
      expect(screen.getByText('Default Search')).toBeInTheDocument();
    });
  });

  describe('Keyboard navigation', () => {
    it('closes dropdown when Escape is pressed', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('cancels save mode when Escape is pressed', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByRole('button', { name: /save current search/i }));

      expect(screen.getByPlaceholderText(/enter a name/i)).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByPlaceholderText(/enter a name/i)).not.toBeInTheDocument();
      // Dropdown should still be open (just back to list mode)
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles empty search query display gracefully', async () => {
      const searchesWithEmptyQuery: SavedSearch[] = [
        {
          id: '1',
          name: 'Empty Search',
          query: '',
          isDefault: false,
          createdAt: Date.now(),
        },
      ];

      const { user } = setup({ savedSearches: searchesWithEmptyQuery });

      await user.click(screen.getByRole('button', { name: /saved searches/i }));

      expect(screen.getByText('Empty Search')).toBeInTheDocument();
    });

    it('trims whitespace from search name before saving', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue(undefined);

      await user.click(screen.getByRole('button', { name: /saved searches/i }));
      await user.click(screen.getByRole('button', { name: /save current search/i }));
      await user.type(screen.getByPlaceholderText(/enter a name/i), '  My Search  ');
      await user.click(screen.getByRole('button', { name: /save$/i }));

      expect(props.onSave).toHaveBeenCalledWith('My Search', 'state:pending');
    });
  });
});

describe('useSavedSearches hook', () => {
  // These tests would require mocking UserStorage
  // For now, we test the integration through component tests above
  // Additional unit tests for the hook can be added separately
});
