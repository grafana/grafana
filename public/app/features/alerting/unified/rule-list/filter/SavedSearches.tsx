/**
 * SavedSearches Component
 *
 * Allows users to save, manage, and quickly apply search queries on the Alert Rules page.
 *
 * ## Features
 * - Save current search query with a custom name
 * - Mark one search as "default" (auto-applied on navigation)
 * - Rename, delete, and apply saved searches
 * - Alphabetical sorting with default search pinned first
 *
 * ## Props
 * @param savedSearches - Array of saved search objects
 * @param currentSearchQuery - The current search query string from the filter state
 * @param onSave - Callback to save a new search. Returns ValidationError on failure.
 * @param onRename - Callback to rename an existing search. Returns ValidationError on failure.
 * @param onDelete - Callback to delete a search
 * @param onApply - Callback when a saved search is applied
 * @param onSetDefault - Callback to set/unset default search (pass null to unset)
 * @param disabled - Disables all interactions
 * @param className - Additional CSS class name
 *
 * ## Internal States
 * - Dropdown open/closed
 * - Save mode (inputting new search name)
 * - Rename mode (editing existing search name, by item ID)
 * - Delete confirm mode (confirming deletion, by item ID)
 *
 * ## Accessibility
 * - Uses role="dialog" for the dropdown panel
 * - Basic keyboard navigation (Escape to close, Tab to navigate)
 * - Focus moves to "Save current search" button when dropdown opens
 *
 * @example
 * ```tsx
 * <SavedSearches
 *   savedSearches={savedSearches}
 *   currentSearchQuery={searchQuery}
 *   onSave={handleSave}
 *   onRename={handleRename}
 *   onDelete={handleDelete}
 *   onApply={handleApply}
 *   onSetDefault={handleSetDefault}
 * />
 * ```
 */

import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, Dropdown, Icon, IconButton, Input, Menu, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { PopupCard } from '../../components/HoverCard';

// ============================================================================
// Types
// ============================================================================

export interface SavedSearch {
  id: string;
  name: string;
  isDefault: boolean;
  query: string;
  createdAt?: number;
}

export interface ValidationError {
  field: 'name';
  message: string;
}

export interface SavedSearchesProps {
  /** Array of saved search objects */
  savedSearches: SavedSearch[];
  /** The current search query string from the filter state */
  currentSearchQuery: string;
  /** Callback to save a new search. Returns ValidationError on failure, void on success. */
  onSave: (name: string, query: string) => Promise<void | ValidationError>;
  /** Callback to rename an existing search. Returns ValidationError on failure, void on success. */
  onRename: (id: string, newName: string) => Promise<void | ValidationError>;
  /** Callback to delete a search */
  onDelete: (id: string) => Promise<void>;
  /** Callback when a saved search is applied */
  onApply: (search: SavedSearch) => void;
  /** Callback to set/unset default search. Pass null to remove default. */
  onSetDefault: (id: string | null) => Promise<void>;
  /** Whether saved searches are still loading from storage */
  isLoading?: boolean;
  /** Additional CSS class name */
  className?: string;
}

// Internal state types - single active action to prevent conflicts
type ActiveAction = 'idle' | { type: 'saving' } | { type: 'renaming'; id: string } | { type: 'deleting'; id: string };

// ============================================================================
// Constants
// ============================================================================

const MAX_NAME_LENGTH = 64;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates a saved search name.
 * @param name - The name to validate
 * @param savedSearches - Existing saved searches for uniqueness check
 * @param excludeId - Optional ID to exclude from uniqueness check (for rename)
 * @returns Error message string or null if valid
 */
function validateSearchName(name: string, savedSearches: SavedSearch[], excludeId?: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return t('alerting.saved-searches.error-name-required', 'Name is required');
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return t('alerting.saved-searches.error-name-too-long', 'Name must be {{max}} characters or less', {
      max: MAX_NAME_LENGTH,
    });
  }

  const isDuplicate = savedSearches.some(
    (s) => (excludeId ? s.id !== excludeId : true) && s.name.toLowerCase() === trimmed.toLowerCase()
  );

  if (isDuplicate) {
    return t('alerting.saved-searches.error-name-duplicate', 'A saved search with this name already exists');
  }

  return null;
}

// ============================================================================
// Main Component
// ============================================================================

export function SavedSearches({
  savedSearches,
  currentSearchQuery,
  onSave,
  onRename,
  onDelete,
  onApply,
  onSetDefault,
  isLoading = false,
  className,
}: SavedSearchesProps) {
  // Dropdown state - single active action to prevent conflicts
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>('idle');

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Sort saved searches: default first, then alphabetically
  const sortedSearches = useMemo(() => {
    const searches = [...savedSearches];
    const defaultSearch = searches.find((s) => s.isDefault);
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    const others = searches.filter((s) => !s.isDefault).sort((a, b) => collator.compare(a.name, b.name));

    return defaultSearch ? [defaultSearch, ...others] : others;
  }, [savedSearches]);

  // Reset internal state when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setActiveAction('idle');
    }
  }, [isOpen]);

  // Focus "Save current search" button when dropdown opens
  useEffect(() => {
    if (isOpen && activeAction === 'idle' && saveButtonRef.current) {
      // Small delay to ensure the dropdown is rendered
      const timer = setTimeout(() => {
        saveButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, activeAction]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        dropdownRef.current &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        // Check if click is on a portal element (menu dropdown)
        if (event.target instanceof Element) {
          const isPortalClick =
            event.target.closest('[data-popper-placement]') || event.target.closest('[role="menu"]');

          if (!isPortalClick) {
            setIsOpen(false);
          }
        } else {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Escape key to close dropdown
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        // If an action is active, cancel it first
        if (activeAction !== 'idle') {
          setActiveAction('idle');
        } else {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeAction]);

  // Handlers
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleStartSave = useCallback(() => {
    setActiveAction({ type: 'saving' });
  }, []);

  const handleCancelSave = useCallback(() => {
    setActiveAction('idle');
  }, []);

  const handleSaveComplete = useCallback(
    async (name: string): Promise<ValidationError | void> => {
      const result = await onSave(name, currentSearchQuery);
      if (!result) {
        setActiveAction('idle');
      }
      return result;
    },
    [onSave, currentSearchQuery]
  );

  const handleStartRename = useCallback((id: string) => {
    setActiveAction({ type: 'renaming', id });
  }, []);

  const handleCancelRename = useCallback(() => {
    setActiveAction('idle');
  }, []);

  const handleRenameComplete = useCallback(
    async (id: string, newName: string): Promise<ValidationError | void> => {
      const result = await onRename(id, newName);
      if (!result) {
        setActiveAction('idle');
      }
      return result;
    },
    [onRename]
  );

  const handleStartDelete = useCallback((id: string) => {
    setActiveAction({ type: 'deleting', id });
  }, []);

  const handleCancelDelete = useCallback(() => {
    setActiveAction('idle');
  }, []);

  const handleDeleteConfirm = useCallback(
    async (id: string) => {
      await onDelete(id);
      setActiveAction('idle');
    },
    [onDelete]
  );

  const handleApply = useCallback(
    (search: SavedSearch) => {
      // Only allow apply when no action is active
      if (activeAction !== 'idle') {
        return;
      }
      onApply(search);
      setIsOpen(false);
    },
    [onApply, activeAction]
  );

  const handleSetDefault = useCallback(
    async (id: string | null) => {
      // Only allow set default when no action is active
      if (activeAction !== 'idle') {
        return;
      }
      await onSetDefault(id);
    },
    [onSetDefault, activeAction]
  );

  const buttonLabel = t('alerting.saved-searches.button-label', 'Saved searches');
  const hasSearches = sortedSearches.length > 0;
  const canSave = currentSearchQuery.trim().length > 0;

  return (
    <PopupCard
      showOn="click"
      placement="bottom-end"
      disableBlur={true}
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onToggle={handleToggle}
      content={
        <Box
          ref={dropdownRef}
          padding={1.5}
          width="320px"
          role="dialog"
          aria-label={t('alerting.saved-searches.dropdown-aria-label', 'Saved searches')}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
            }
          }}
        >
          <ListMode
            searches={sortedSearches}
            hasSearches={hasSearches}
            canSave={canSave}
            activeAction={activeAction}
            saveButtonRef={saveButtonRef}
            isLoading={isLoading}
            onStartSave={handleStartSave}
            onSaveComplete={handleSaveComplete}
            onCancelSave={handleCancelSave}
            onApply={handleApply}
            onStartRename={handleStartRename}
            onCancelRename={handleCancelRename}
            onRenameComplete={handleRenameComplete}
            onStartDelete={handleStartDelete}
            onCancelDelete={handleCancelDelete}
            onDeleteConfirm={handleDeleteConfirm}
            onSetDefault={handleSetDefault}
            savedSearches={savedSearches}
          />
        </Box>
      }
    >
      <Button
        variant="secondary"
        icon="bookmark"
        disabled={isLoading}
        aria-label={buttonLabel}
        aria-expanded={isOpen}
        className={className}
      >
        {buttonLabel}
      </Button>
    </PopupCard>
  );
}

// ============================================================================
// List Mode (shows saved searches or empty state)
// ============================================================================

interface ListModeProps {
  searches: SavedSearch[];
  hasSearches: boolean;
  canSave: boolean;
  activeAction: ActiveAction;
  saveButtonRef: React.RefObject<HTMLButtonElement>;
  isLoading: boolean;
  onStartSave: () => void;
  onSaveComplete: (name: string) => Promise<ValidationError | void>;
  onCancelSave: () => void;
  onApply: (search: SavedSearch) => void;
  onStartRename: (id: string) => void;
  onCancelRename: () => void;
  onRenameComplete: (id: string, newName: string) => Promise<ValidationError | void>;
  onStartDelete: (id: string) => void;
  onCancelDelete: () => void;
  onDeleteConfirm: (id: string) => Promise<void>;
  onSetDefault: (id: string | null) => Promise<void>;
  savedSearches: SavedSearch[];
}

function ListMode({
  searches,
  hasSearches,
  canSave,
  activeAction,
  saveButtonRef,
  isLoading,
  onStartSave,
  onSaveComplete,
  onCancelSave,
  onApply,
  onStartRename,
  onCancelRename,
  onRenameComplete,
  onStartDelete,
  onCancelDelete,
  onDeleteConfirm,
  onSetDefault,
  savedSearches,
}: ListModeProps) {
  const styles = useStyles2(getStyles);

  // Derived states from activeAction
  const isSaveMode = typeof activeAction === 'object' && activeAction.type === 'saving';
  const isActionActive = activeAction !== 'idle';

  // Show loading state
  if (isLoading) {
    return (
      <Box padding={2} display="flex" justifyContent="center" alignItems="center">
        <Spinner size="lg" />
      </Box>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      {/* Save current search - button or inline input */}
      {isSaveMode ? (
        <div className={styles.item}>
          <InlineSaveInput onSave={onSaveComplete} onCancel={onCancelSave} savedSearches={savedSearches} />
        </div>
      ) : (
        <Box display="flex" justifyContent="flex-end">
          <Button
            ref={saveButtonRef}
            variant="secondary"
            icon="plus"
            onClick={onStartSave}
            disabled={!canSave || isActionActive}
            title={
              !canSave ? t('alerting.saved-searches.save-disabled-tooltip', 'Enter a search query first') : undefined
            }
          >
            <Trans i18nKey="alerting.saved-searches.save-current-search">Save current search</Trans>
          </Button>
        </Box>
      )}

      {/* Empty state or list */}
      {!hasSearches ? (
        <EmptyState />
      ) : (
        <Stack direction="column" gap={0.5}>
          <div
            className={styles.list}
            role="list"
            aria-label={t('alerting.saved-searches.list-aria-label', 'Saved searches list')}
          >
            {searches.map((search) => {
              const isRenaming =
                typeof activeAction === 'object' && activeAction.type === 'renaming' && activeAction.id === search.id;
              const isDeleting =
                typeof activeAction === 'object' && activeAction.type === 'deleting' && activeAction.id === search.id;
              // Item is disabled if any action is active and this item is not the one being acted upon
              const isItemDisabled = isActionActive && !isRenaming && !isDeleting;

              return (
                <SavedSearchItem
                  key={search.id}
                  search={search}
                  isRenaming={isRenaming}
                  isDeleting={isDeleting}
                  isDisabled={isItemDisabled}
                  onApply={() => onApply(search)}
                  onStartRename={() => onStartRename(search.id)}
                  onCancelRename={onCancelRename}
                  onRenameComplete={(newName) => onRenameComplete(search.id, newName)}
                  onStartDelete={() => onStartDelete(search.id)}
                  onCancelDelete={onCancelDelete}
                  onDeleteConfirm={() => onDeleteConfirm(search.id)}
                  onSetDefault={() => onSetDefault(search.isDefault ? null : search.id)}
                  savedSearches={savedSearches}
                />
              );
            })}
          </div>
        </Stack>
      )}
    </Stack>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <Box padding={2} display="flex" justifyContent="center">
      <Text color="secondary" italic>
        <Trans i18nKey="alerting.saved-searches.empty-state">No saved searches yet</Trans>
      </Text>
    </Box>
  );
}

// ============================================================================
// Inline Save Input (compact input with icon buttons)
// ============================================================================

interface InlineSaveInputProps {
  onSave: (name: string) => Promise<ValidationError | void>;
  onCancel: () => void;
  savedSearches: SavedSearch[];
}

function InlineSaveInput({ onSave, onCancel, savedSearches }: InlineSaveInputProps) {
  const styles = useStyles2(getStyles);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clear error when value changes
  useEffect(() => {
    if (error) {
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSubmit = async () => {
    const validationError = validateSearchName(value, savedSearches);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSave(value.trim());
      if (result?.message) {
        setError(result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Stack direction="column" gap={0.5}>
      {/* Match exact structure of SavedSearchItem: [flex-1 content] [icon] [icon] with gap={1} */}
      <Stack direction="row" alignItems="center" gap={1} wrap={false}>
        {/* Input area - flex=1 like the name area in list items */}
        <Box flex={1} marginRight={2}>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('alerting.saved-searches.name-placeholder', 'Enter a name...')}
            invalid={!!error}
            disabled={isSubmitting}
            maxLength={MAX_NAME_LENGTH}
          />
        </Box>

        {/* X icon - aligned with magnifying glass */}
        <IconButton
          name="times"
          aria-label={t('alerting.saved-searches.cancel', 'Cancel')}
          onClick={onCancel}
          disabled={isSubmitting}
          tooltip={t('alerting.saved-searches.cancel', 'Cancel')}
          size="md"
          variant="secondary"
        />

        {/* Check icon - aligned with action menu */}
        <IconButton
          name="check"
          aria-label={t('alerting.saved-searches.save-button', 'Save')}
          onClick={handleSubmit}
          disabled={isSubmitting}
          tooltip={t('alerting.saved-searches.save-button', 'Save')}
          className={styles.successIcon}
          size="md"
          variant="secondary"
        />
      </Stack>
      {error && (
        <Text color="error" variant="bodySmall">
          {error}
        </Text>
      )}
    </Stack>
  );
}

// ============================================================================
// Inline Rename Input (compact input with icon buttons for renaming)
// ============================================================================

interface InlineRenameInputProps {
  initialValue: string;
  onSave: (name: string) => Promise<ValidationError | void>;
  onCancel: () => void;
  savedSearches: SavedSearch[];
  excludeId: string;
}

function InlineRenameInput({ initialValue, onSave, onCancel, savedSearches, excludeId }: InlineRenameInputProps) {
  const styles = useStyles2(getStyles);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Clear error when value changes
  useEffect(() => {
    if (error) {
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSubmit = async () => {
    const validationError = validateSearchName(value, savedSearches, excludeId);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSave(value.trim());
      if (result?.message) {
        setError(result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction="row" alignItems="center" gap={1} wrap={false}>
        {/* Input area - flex=1 like the name area in list items */}
        <Box flex={1} marginRight={2}>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('alerting.saved-searches.name-placeholder', 'Enter a name...')}
            invalid={!!error}
            disabled={isSubmitting}
            maxLength={MAX_NAME_LENGTH}
          />
        </Box>

        {/* X icon - cancel */}
        <IconButton
          name="times"
          aria-label={t('alerting.saved-searches.cancel', 'Cancel')}
          onClick={onCancel}
          disabled={isSubmitting}
          tooltip={t('alerting.saved-searches.cancel', 'Cancel')}
          size="md"
          variant="secondary"
        />

        {/* Check icon - confirm rename */}
        <IconButton
          name="check"
          aria-label={t('alerting.saved-searches.rename-button', 'Rename')}
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="md"
          tooltip={t('alerting.saved-searches.rename-button', 'Rename')}
          className={styles.successIcon}
          variant="secondary"
        />
      </Stack>
      {error && (
        <Text color="error" variant="bodySmall">
          {error}
        </Text>
      )}
    </Stack>
  );
}

// ============================================================================
// Saved Search Item
// ============================================================================

interface SavedSearchItemProps {
  search: SavedSearch;
  isRenaming: boolean;
  isDeleting: boolean;
  isDisabled: boolean;
  onApply: () => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onRenameComplete: (newName: string) => Promise<ValidationError | void>;
  onStartDelete: () => void;
  onCancelDelete: () => void;
  onDeleteConfirm: () => Promise<void>;
  onSetDefault: () => void;
  savedSearches: SavedSearch[];
}

function SavedSearchItem({
  search,
  isRenaming,
  isDeleting,
  isDisabled,
  onApply,
  onStartRename,
  onCancelRename,
  onRenameComplete,
  onStartDelete,
  onCancelDelete,
  onDeleteConfirm,
  onSetDefault,
  savedSearches,
}: SavedSearchItemProps) {
  const styles = useStyles2(getStyles);

  // Rename mode - inline form matching the save form
  if (isRenaming) {
    return (
      <div className={styles.item} role="listitem">
        <InlineRenameInput
          initialValue={search.name}
          onSave={onRenameComplete}
          onCancel={onCancelRename}
          savedSearches={savedSearches}
          excludeId={search.id}
        />
      </div>
    );
  }

  // Delete confirm mode - inline with name visible
  if (isDeleting) {
    return (
      <div className={styles.item} role="listitem">
        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
          {/* Name remains visible */}
          <Stack direction="row" alignItems="center" gap={0.5} flex={1}>
            <Text truncate>{search.name}</Text>
          </Stack>

          {/* X icon - cancel delete */}
          <IconButton
            name="times"
            aria-label={t('alerting.saved-searches.cancel', 'Cancel')}
            onClick={onCancelDelete}
            tooltip={t('alerting.saved-searches.cancel', 'Cancel')}
            size="md"
            variant="secondary"
          />

          {/* Trash icon - confirm delete */}
          <IconButton
            name="trash-alt"
            aria-label={t('alerting.saved-searches.delete-button', 'Delete')}
            onClick={onDeleteConfirm}
            tooltip={t('alerting.saved-searches.delete-button', 'Delete')}
            size="md"
            variant="secondary"
            className={styles.deleteIcon}
          />
        </Stack>
      </div>
    );
  }

  // Default display mode
  return (
    <div className={styles.item} role="listitem">
      <Stack direction="row" alignItems="center" gap={1} wrap={false}>
        {/* Name and default indicator */}
        <Stack direction="row" alignItems="center" gap={0.5} flex={1}>
          <Text truncate>{search.name}</Text>
          {search.isDefault && (
            <Icon
              name="favorite"
              size="sm"
              className={styles.defaultIcon}
              title={t('alerting.saved-searches.default-indicator', 'Default search')}
            />
          )}
        </Stack>

        {/* Apply button (magnifying glass) */}
        <IconButton
          name="search"
          aria-label={t('alerting.saved-searches.apply-aria-label', 'Apply search "{{name}}"', {
            name: search.name,
          })}
          onClick={onApply}
          tooltip={t('alerting.saved-searches.apply-tooltip', 'Apply this search')}
          size="md"
          variant="secondary"
          disabled={isDisabled}
        />

        {/* Action menu */}
        <ActionMenu
          isDefault={search.isDefault}
          isDisabled={isDisabled}
          onSetDefault={onSetDefault}
          onRename={onStartRename}
          onDelete={onStartDelete}
        />
      </Stack>
    </div>
  );
}

// ============================================================================
// Action Menu (three-dot menu)
// ============================================================================

interface ActionMenuProps {
  isDefault: boolean;
  isDisabled: boolean;
  onSetDefault: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ActionMenu({ isDefault, isDisabled, onSetDefault, onRename, onDelete }: ActionMenuProps) {
  const menu = (
    <Menu>
      <Menu.Item
        label={
          isDefault
            ? t('alerting.saved-searches.remove-default', 'Remove default')
            : t('alerting.saved-searches.set-default', 'Set as default')
        }
        icon={isDefault ? 'star' : 'favorite'}
        onClick={onSetDefault}
      />
      <Menu.Item label={t('alerting.saved-searches.rename', 'Rename')} icon="pen" onClick={onRename} />
      <Menu.Divider />
      <Menu.Item
        label={t('alerting.saved-searches.delete', 'Delete')}
        icon="trash-alt"
        destructive
        onClick={onDelete}
      />
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-end">
      <IconButton
        name="ellipsis-v"
        aria-label={t('alerting.saved-searches.actions-aria-label', 'Actions')}
        variant="secondary"
        size="md"
        disabled={isDisabled}
      />
    </Dropdown>
  );
}

// ============================================================================
// Styles
// ============================================================================

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      maxHeight: '300px',
      overflowY: 'auto',
    }),
    item: css({
      padding: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    defaultIcon: css({
      color: theme.colors.warning.main,
      flexShrink: 0,
    }),
    successIcon: css({
      color: theme.colors.success.main,
    }),
    deleteIcon: css({
      color: theme.colors.error.main,
    }),
  };
}

export default SavedSearches;
