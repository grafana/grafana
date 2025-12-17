import { render, screen, waitFor } from 'test/test-utils';
import { byPlaceholderText, byRole, byText } from 'testing-library-selector';

import { SavedSearches } from './SavedSearches';
import { SavedSearch } from './savedSearchesSchema';

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
  // Menu items (using byRole for proper accessibility testing)
  setAsDefaultMenuItem: byRole('menuitem', { name: /set as default/i }),
  removeDefaultMenuItem: byRole('menuitem', { name: /remove default/i }),
  renameMenuItem: byRole('menuitem', { name: /rename/i }),
  deleteMenuItem: byRole('menuitem', { name: /^delete$/i }),
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
  // render from test/test-utils provides the user object for interactions
  const view = render(<SavedSearches {...mergedProps} />);
  return { ...view, props: mergedProps };
}

describe('SavedSearches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Displaying saved searches', () => {
    it('shows empty state when no saved searches exist', async () => {
      const { user } = setup({ savedSearches: [] });

      await user.click(ui.savedSearchesButton.get());

      expect(ui.emptyStateMessage.get()).toBeInTheDocument();
    });

    it('displays saved searches with default search marked with star icon', async () => {
      const { user } = setup();

      await user.click(ui.savedSearchesButton.get());

      // Verify searches are displayed
      const applyButtons = await ui.applyButtons.findAll();
      expect(applyButtons).toHaveLength(3);

      // Verify the default search has a star icon
      expect(screen.getByText('Default Search')).toBeInTheDocument();
      expect(screen.getByTitle('Default search')).toBeInTheDocument();
    });
  });

  describe('Saving a search', () => {
    it('saves current search with the provided name', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue(undefined);

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.type(await ui.saveInput.find(), 'My New Search');
      await user.click(ui.saveConfirmButton.get());

      expect(props.onSave).toHaveBeenCalledWith('My New Search', 'state:pending');
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

    it('shows validation error when name is empty', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.click(await ui.saveConfirmButton.find());

      expect(await ui.nameRequiredError.find()).toBeInTheDocument();
    });

    it('shows validation error for duplicate name', async () => {
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

    it('trims whitespace from search name before saving', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });
      props.onSave.mockResolvedValue(undefined);

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.type(await ui.saveInput.find(), '  My Search  ');
      await user.click(ui.saveConfirmButton.get());

      expect(props.onSave).toHaveBeenCalledWith('My Search', 'state:pending');
    });

    it('cancels save when cancel button is clicked', async () => {
      const { user, props } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      await user.click(await ui.cancelButton.find());

      expect(props.onSave).not.toHaveBeenCalled();
      expect(ui.saveInput.query()).not.toBeInTheDocument();
    });
  });

  describe('Applying a search', () => {
    it('applies the selected search and closes dropdown', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());
      const applyButtons = await ui.applyButtons.findAll();
      // Click the apply button for "My Firing Rules" (third in sorted list: Default, Critical, My Firing)
      await user.click(applyButtons[2]);

      expect(props.onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          name: 'My Firing Rules',
          query: 'state:firing',
        })
      );

      await waitFor(() => {
        expect(ui.dropdown.query()).not.toBeInTheDocument();
      });
    });
  });

  describe('Setting default search', () => {
    it('sets a search as default', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());
      // Use a non-default search's menu (second item after sorting)
      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[1]);
      await user.click(await ui.setAsDefaultMenuItem.find());

      expect(props.onSetDefault).toHaveBeenCalled();
    });

    it('removes default from a search', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());
      // Default Search is first item
      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.removeDefaultMenuItem.find());

      expect(props.onSetDefault).toHaveBeenCalledWith(null);
    });
  });

  describe('Renaming a search', () => {
    it('renames a search successfully', async () => {
      const { user, props } = setup();
      props.onRename.mockResolvedValue(undefined);

      await user.click(ui.savedSearchesButton.get());
      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.renameMenuItem.find());

      const input = await screen.findByDisplayValue('Default Search');
      await user.clear(input);
      await user.type(input, 'Renamed Search');
      await user.keyboard('{Enter}');

      expect(props.onRename).toHaveBeenCalledWith('2', 'Renamed Search');
    });

    it('shows validation error for duplicate name when renaming', async () => {
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

  describe('Deleting a search', () => {
    it('deletes a search after confirmation', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());
      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.deleteMenuItem.find());

      // Confirm delete
      const deleteButtons = await ui.deleteButton.findAll();
      await user.click(deleteButtons[deleteButtons.length - 1]);

      expect(props.onDelete).toHaveBeenCalledWith('2');
    });

    it('cancels delete when cancel is clicked', async () => {
      const { user, props } = setup();

      await user.click(ui.savedSearchesButton.get());
      const menuButtons = await ui.actionMenuButtons.findAll();
      await user.click(menuButtons[0]);
      await user.click(await ui.deleteMenuItem.find());

      await user.click(await ui.cancelButton.find());

      expect(props.onDelete).not.toHaveBeenCalled();
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

    it('cancels save mode when Escape is pressed without closing dropdown', async () => {
      const { user } = setup({ currentSearchQuery: 'state:pending' });

      await user.click(ui.savedSearchesButton.get());
      await user.click(await ui.saveButton.find());
      expect(await ui.saveInput.find()).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(ui.saveInput.query()).not.toBeInTheDocument();
      });
      // Dropdown should still be open
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
  });
});
