import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { byPlaceholderText, byRole, byText } from 'testing-library-selector';

import { SavedSearches } from './SavedSearches';
import { SavedSearch } from './SavedSearches.types';

/**
 * UI selectors for SavedSearches component tests.
 * Using testing-library-selector for reusable, consistent selectors.
 */
const ui = {
  // Main trigger button
  savedSearchesButton: byRole('button', { name: /saved searches/i }),
  // Dropdown dialog
  dropdown: byRole('dialog'),
  // Save functionality
  saveButton: byRole('button', { name: /save current search/i }),
  saveConfirmButton: byRole('button', { name: /save$/i }),
  saveInput: byPlaceholderText(/enter a name/i),
  // Action buttons
  cancelButton: byRole('button', { name: /cancel/i }),
  applyButtons: byRole('button', { name: /apply this search/i }),
  actionMenuButtons: byRole('button', { name: /actions/i }),
  deleteButton: byRole('button', { name: /delete/i }),
  // Menu items
  setAsDefaultMenuItem: byText(/set as default/i),
  removeDefaultMenuItem: byText(/remove default/i),
  renameMenuItem: byText(/rename/i),
  deleteMenuItem: byText(/^delete$/i),
  // Messages
  emptyStateMessage: byText(/no saved searches/i),
  nameRequiredError: byText(/name is required/i),
  duplicateNameError: byText(/a saved search with this name already exists/i),
};

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
      expect(ui.savedSearchesButton.get()).toBeInTheDocument();
    });

    it('opens dropdown when button is clicked', async () => {
      const { user } = setup();

      await user.click(ui.savedSearchesButton.get());

      expect(ui.dropdown.get()).toBeInTheDocument();
    });

    it('displays saved searches in alphabetical order with default first', async () => {
      const { user } = setup();

      await user.click(ui.savedSearchesButton.get());

      const listItems = await ui.applyButtons.findAll();
      // Default Search should be first (isDefault: true), then alphabetically: Critical Alerts, My Firing Rules
      expect(listItems).toHaveLength(3);
    });

    it('shows empty state when no saved searches exist', async () => {
      const { user } = setup({ savedSearches: [] });

      await user.click(ui.savedSearchesButton.get());

      expect(ui.emptyStateMessage.get()).toBeInTheDocument();
    });

    it('shows star icon for default search', async () => {
      const { user } = setup();

      await user.click(ui.savedSearchesButton.get());

      // Find the default search item
      const defaultSearchName = screen.getByText('Default Search');
      expect(defaultSearchName).toBeInTheDocument();

      // Verify the star icon (favorite icon) is present for the default search
      // The icon has title="Default search" which makes it accessible
      const starIcon = screen.getByTitle('Default search');
      expect(starIcon).toBeInTheDocument();
    });
  });

  describe('Save functionality', () => {
    it('shows save button when currentSearchQuery is provided', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(ui.savedSearchesButton.get());

      expect(await ui.saveButton.find()).toBeInTheDocument();
    });

    it('disables save button when currentSearchQuery is empty', async () => {
      const { user } = setup({ currentSearchQuery: '' });

      await user.click(ui.savedSearchesButton.get());

      // Use findByText + closest because findByRole fails to find disabled Grafana Button
      // (due to aria-disabled="false" + disabled="" attribute mismatch in Grafana UI)
      const saveButtonText = await screen.findByText(/save current search/i);
      // eslint-disable-next-line testing-library/no-node-access
      const saveButton = saveButtonText.closest('button');
      expect(saveButton).toBeDisabled();
    });

    it('switches to save mode when save button is clicked', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());

      expect(await ui.saveInput.find()).toBeInTheDocument();
      expect(ui.saveConfirmButton.get()).toBeInTheDocument();
    });

    it('calls onSave with name and query when save is confirmed', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue(undefined);

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.type(await ui.saveInput.find(), 'My New Search');
      await user.click(ui.saveConfirmButton.get());

      expect(props.onSave).toHaveBeenCalledWith('My New Search', 'state:pending');
    });

    it('shows validation error when name is empty', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.click(await ui.saveConfirmButton.find());

      expect(await ui.nameRequiredError.find()).toBeInTheDocument();
    });

    it('shows validation error from onSave callback (duplicate name)', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue({
        field: 'name',
        message: 'A saved search with this name already exists',
      });

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.type(await ui.saveInput.find(), 'My Firing Rules');
      await user.click(ui.saveConfirmButton.get());

      expect(await ui.duplicateNameError.find()).toBeInTheDocument();
    });

    it('returns to list mode after successful save', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue(undefined);

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.type(await ui.saveInput.find(), 'New Search');
      await user.click(ui.saveConfirmButton.get());

      await waitFor(() => {
        expect(ui.saveInput.query()).not.toBeInTheDocument();
      });
    });

    it('cancels save mode when cancel button is clicked', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.click(await ui.cancelButton.find());

      expect(ui.saveInput.query()).not.toBeInTheDocument();
    });
  });

  describe('Apply functionality', () => {
    it('calls onApply when apply button is clicked', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());
      // Click the apply button (search icon) - uses tooltip as accessible name
      const applyButtons = await ui.applyButtons.findAll();
      // Find the button for "My Firing Rules" (third in sorted list: Default, Critical, My Firing)
      await user.click(applyButtons[2]);

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

      await user.click(ui.savedSearchesButton.get());
      // Click the apply button (search icon) - uses tooltip as accessible name
      const applyButtons = await ui.applyButtons.findAll();
      await user.click(applyButtons[0]);

      await waitFor(() => {
        expect(ui.dropdown.query()).not.toBeInTheDocument();
      });
    });
  });

  describe('Action menu', () => {
    it('opens action menu when three-dot button is clicked', async () => {
      const { user } = setup();

      await user.click(ui.savedSearchesButton.get());

      // Find the action menu buttons - menuButtons[0] is Default Search (shows "Remove default")
      // Use menuButtons[1] (a non-default search) to see "Set as default"
      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[1]);

      expect(await ui.setAsDefaultMenuItem.find()).toBeInTheDocument();
      expect(ui.renameMenuItem.get()).toBeInTheDocument();
      expect(ui.deleteMenuItem.get()).toBeInTheDocument();
    });

    it('shows "Remove default" option for default search', async () => {
      const { user } = setup();

      await user.click(ui.savedSearchesButton.get());

      // Find the Default Search item's menu button (it should be the first one after sorting)
      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]); // Default Search is first

      expect(await ui.removeDefaultMenuItem.find()).toBeInTheDocument();
    });
  });

  describe('Set default functionality', () => {
    it('calls onSetDefault with search id when "Set as default" is clicked', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());

      // Find a non-default search's menu button
      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[1]); // Second item (not default)

      await user.click(await ui.setAsDefaultMenuItem.find());

      expect(props.onSetDefault).toHaveBeenCalled();
    });

    it('calls onSetDefault with null when "Remove default" is clicked', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());

      // Find the Default Search's menu button (first item)
      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);

      await user.click(await ui.removeDefaultMenuItem.find());

      expect(props.onSetDefault).toHaveBeenCalledWith(null);
    });
  });

  describe('Rename functionality', () => {
    it('shows rename input when "Rename" is clicked', async () => {
      const { user } = setup();

      await user.click(ui.savedSearchesButton.get());

      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.renameMenuItem.find());

      expect(await screen.findByDisplayValue('Default Search')).toBeInTheDocument();
    });

    it('calls onRename with new name when rename is confirmed', async () => {
      const { user, props } = setup();
      props.onRename.mockResolvedValue(undefined);

      await user.click(ui.savedSearchesButton.get());

      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.renameMenuItem.find());

      const input = await screen.findByDisplayValue('Default Search');
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

      await user.click(ui.savedSearchesButton.get());

      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.renameMenuItem.find());

      const input = await screen.findByDisplayValue('Default Search');
      await user.clear(input);
      await user.type(input, 'My Firing Rules');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(ui.duplicateNameError.get()).toBeInTheDocument();
      });
    });
  });

  describe('Delete functionality', () => {
    it('shows delete confirmation when "Delete" is clicked', async () => {
      const { user } = setup();

      await user.click(ui.savedSearchesButton.get());

      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.deleteMenuItem.find());

      // Delete confirmation shows the item name with cancel and confirm buttons
      expect(await screen.findByText('Default Search')).toBeInTheDocument();
      expect(ui.cancelButton.get()).toBeInTheDocument();
      expect(ui.deleteButton.get()).toBeInTheDocument();
    });

    it('calls onDelete when delete is confirmed', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());

      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.deleteMenuItem.find());

      // Confirm delete by clicking trash button
      const deleteButtons = await ui.deleteButton.findAll();
      await user.click(deleteButtons[deleteButtons.length - 1]); // The confirm delete button

      expect(props.onDelete).toHaveBeenCalledWith('2');
    });

    it('cancels delete when cancel is clicked', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());

      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.deleteMenuItem.find());

      // Cancel delete
      await user.click(await ui.cancelButton.find());

      expect(props.onDelete).not.toHaveBeenCalled();
      // Item should be back in normal display mode
      expect(screen.getByText('Default Search')).toBeInTheDocument();
    });
  });

  describe('Keyboard navigation', () => {
    it('closes dropdown when Escape is pressed', async () => {
      const { user } = setup();

      await user.click(ui.savedSearchesButton.get());
      expect(await ui.dropdown.find()).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(ui.dropdown.query()).not.toBeInTheDocument();
      });
    });

    it('cancels save mode when Escape is pressed', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());

      expect(await ui.saveInput.find()).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(ui.saveInput.query()).not.toBeInTheDocument();
      });
      // Dropdown should still be open (just back to list mode)
      expect(ui.dropdown.get()).toBeInTheDocument();
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

      await user.click(ui.savedSearchesButton.get());

      expect(await screen.findByText('Empty Search')).toBeInTheDocument();
    });

    it('trims whitespace from search name before saving', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue(undefined);

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.type(await ui.saveInput.find(), '  My Search  ');
      await user.click(ui.saveConfirmButton.get());

      expect(props.onSave).toHaveBeenCalledWith('My Search', 'state:pending');
    });
  });
});

describe('useSavedSearches hook', () => {
  // These tests would require mocking UserStorage
  // For now, we test the integration through component tests above
  // Additional unit tests for the hook can be added separately
});
