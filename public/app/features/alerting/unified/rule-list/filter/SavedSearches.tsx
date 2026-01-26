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
 * @param onSave - Callback to save a new search. Throws ValidationError on failure.
 * @param onRename - Callback to rename an existing search. Throws ValidationError on failure.
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
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { PopupCard } from '../../components/HoverCard';

import { InlineSaveInput } from './InlineSaveInput';
import { SavedSearchItem } from './SavedSearchItem';
import { SavedSearch } from './savedSearchesSchema';

// ============================================================================
// Types
// ============================================================================

export interface SavedSearchesProps {
  /** Array of saved search objects */
  savedSearches: SavedSearch[];
  /** The current search query string from the filter state */
  currentSearchQuery: string;
  /** Callback to save a new search. Throws ValidationError on failure. */
  onSave: (name: string, query: string) => Promise<void>;
  /** Callback to rename an existing search. Throws ValidationError on failure. */
  onRename: (id: string, newName: string) => Promise<void>;
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

// ============================================================================
// State Management (Reducer)
// ============================================================================

// Active action type - represents the current action in progress
type ActiveAction = 'idle' | { type: 'saving' } | { type: 'renaming'; id: string } | { type: 'deleting'; id: string };

// Component state
interface DropdownState {
  isOpen: boolean;
  activeAction: ActiveAction;
}

// Action types for the reducer
type DropdownAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SET_VISIBLE'; visible: boolean }
  | { type: 'START_SAVE' }
  | { type: 'START_RENAME'; id: string }
  | { type: 'START_DELETE'; id: string }
  | { type: 'CANCEL_ACTION' }
  | { type: 'COMPLETE_ACTION' }
  | { type: 'APPLY_AND_CLOSE' };

const initialState: DropdownState = {
  isOpen: false,
  activeAction: 'idle',
};

/**
 * Reducer for managing dropdown state and active actions.
 * Centralizes all state transitions for easier reasoning and testing.
 */
function dropdownReducer(state: DropdownState, action: DropdownAction): DropdownState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, isOpen: true };

    case 'CLOSE':
      // Reset action when closing
      return { isOpen: false, activeAction: 'idle' };

    case 'SET_VISIBLE':
      // When visibility changes, reset action if closing
      return action.visible ? { ...state, isOpen: true } : { isOpen: false, activeAction: 'idle' };

    case 'START_SAVE':
      // Only start save if no action is active
      return state.activeAction === 'idle' ? { ...state, activeAction: { type: 'saving' } } : state;

    case 'START_RENAME':
      // Only start rename if no action is active
      return state.activeAction === 'idle' ? { ...state, activeAction: { type: 'renaming', id: action.id } } : state;

    case 'START_DELETE':
      // Only start delete if no action is active
      return state.activeAction === 'idle' ? { ...state, activeAction: { type: 'deleting', id: action.id } } : state;

    case 'CANCEL_ACTION':
    case 'COMPLETE_ACTION':
      // Return to idle state
      return { ...state, activeAction: 'idle' };

    case 'APPLY_AND_CLOSE':
      // Only apply if no action is active, then close
      return state.activeAction === 'idle' ? { isOpen: false, activeAction: 'idle' } : state;

    default:
      return state;
  }
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
  const styles = useStyles2(getStyles);

  // Centralized state management via reducer
  const [state, dispatch] = useReducer(dropdownReducer, initialState);
  const { isOpen, activeAction } = state;

  // Refs
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus dialog when dropdown opens to enable keyboard navigation
  useEffect(() => {
    if (isOpen && activeAction === 'idle') {
      // Small delay to ensure the dropdown is rendered
      const timer = setTimeout(() => {
        // Focus the dialog to capture keyboard events (like Escape)
        // We focus the dialog instead of the save button because the button may be disabled
        dialogRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, activeAction]);

  // Handle click outside to close dropdown - excludes portal elements (like action menu)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && dialogRef.current && event.target instanceof Node && !dialogRef.current.contains(event.target)) {
        // Check if click is on a portal element (action menu dropdown)
        if (event.target instanceof Element) {
          const isPortalClick =
            event.target.closest('[data-popper-placement]') || event.target.closest('[role="menu"]');

          if (!isPortalClick) {
            dispatch({ type: 'CLOSE' });
          }
        } else {
          dispatch({ type: 'CLOSE' });
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

  // Handle Escape key: cancel active action first, or close dropdown if no action is active
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        if (activeAction !== 'idle') {
          dispatch({ type: 'CANCEL_ACTION' });
        } else {
          dispatch({ type: 'CLOSE' });
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, activeAction]);

  // Handlers
  const handleToggle = useCallback(() => {
    dispatch({ type: isOpen ? 'CLOSE' : 'OPEN' });
  }, [isOpen]);

  const handleClose = useCallback(() => {
    dispatch({ type: 'CLOSE' });
  }, []);

  const handleStartSave = useCallback(() => {
    dispatch({ type: 'START_SAVE' });
  }, []);

  const handleCancelSave = useCallback(() => {
    dispatch({ type: 'CANCEL_ACTION' });
  }, []);

  const handleSaveComplete = useCallback(
    async (name: string): Promise<void> => {
      await onSave(name, currentSearchQuery);
      dispatch({ type: 'COMPLETE_ACTION' });
    },
    [onSave, currentSearchQuery]
  );

  const handleStartRename = useCallback((id: string) => {
    dispatch({ type: 'START_RENAME', id });
  }, []);

  const handleCancelRename = useCallback(() => {
    dispatch({ type: 'CANCEL_ACTION' });
  }, []);

  const handleRenameComplete = useCallback(
    async (id: string, newName: string): Promise<void> => {
      await onRename(id, newName);
      dispatch({ type: 'COMPLETE_ACTION' });
    },
    [onRename]
  );

  const handleStartDelete = useCallback((id: string) => {
    dispatch({ type: 'START_DELETE', id });
  }, []);

  const handleCancelDelete = useCallback(() => {
    dispatch({ type: 'CANCEL_ACTION' });
  }, []);

  const handleDeleteConfirm = useCallback(
    async (id: string) => {
      await onDelete(id);
      dispatch({ type: 'COMPLETE_ACTION' });
    },
    [onDelete]
  );

  const handleApply = useCallback(
    (search: SavedSearch) => {
      // Only allow apply when no action is active (handled by reducer)
      if (activeAction !== 'idle') {
        return;
      }
      onApply(search);
      dispatch({ type: 'APPLY_AND_CLOSE' });
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
  const hasSearches = savedSearches.length > 0;
  const canSave = currentSearchQuery.trim().length > 0;

  const content = (
    <div
      ref={dialogRef}
      className={styles.dropdown}
      role="dialog"
      aria-label={t('alerting.saved-searches.dropdown-aria-label', 'Saved searches')}
      tabIndex={-1}
    >
      <ListMode
        searches={savedSearches}
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
        menuPortalRoot={dialogRef.current}
      />
    </div>
  );

  return (
    <PopupCard
      content={content}
      placement="bottom-end"
      showOn="click"
      isOpen={isOpen}
      onClose={handleClose}
      onToggle={handleToggle}
      disableBlur
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
  /** Callback to complete save. Throws ValidationError on validation failure. */
  onSaveComplete: (name: string) => Promise<void>;
  onCancelSave: () => void;
  onApply: (search: SavedSearch) => void;
  onStartRename: (id: string) => void;
  onCancelRename: () => void;
  /** Callback to complete rename. Throws ValidationError on validation failure. */
  onRenameComplete: (id: string, newName: string) => Promise<void>;
  onStartDelete: (id: string) => void;
  onCancelDelete: () => void;
  onDeleteConfirm: (id: string) => Promise<void>;
  onSetDefault: (id: string | null) => Promise<void>;
  savedSearches: SavedSearch[];
  /** Portal root for action menus - renders inside the dropdown to prevent useDismiss issues */
  menuPortalRoot: HTMLElement | null;
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
  menuPortalRoot,
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
      {/* Stop propagation to prevent Dropdown from closing when interacting with save form */}
      {isSaveMode ? (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div className={styles.item} onClick={(e) => e.stopPropagation()}>
          <InlineSaveInput onSave={onSaveComplete} onCancel={onCancelSave} savedSearches={savedSearches} />
        </div>
      ) : (
        <Box display="flex" justifyContent="flex-end">
          <Button
            ref={saveButtonRef}
            variant="secondary"
            icon="plus"
            onClick={(e) => {
              e.stopPropagation(); // Prevent dropdown from closing
              onStartSave();
            }}
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
                  menuPortalRoot={menuPortalRoot}
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
// Styles
// ============================================================================

function getStyles(theme: GrafanaTheme2) {
  return {
    dropdown: css({
      width: '320px',
      padding: theme.spacing(0.5),
    }),
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
  };
}
