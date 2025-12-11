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
import { Box, Button, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { PopupCard } from '../../components/HoverCard';

import { InlineSaveInput } from './InlineSaveInput';
import { SavedSearchItem } from './SavedSearchItem';
import { SavedSearch, ValidationError } from './SavedSearches.types';

// ============================================================================
// Types
// ============================================================================

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
  };
}
