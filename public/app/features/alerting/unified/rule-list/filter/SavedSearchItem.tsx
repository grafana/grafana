import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, IconButton, Menu, Stack, Text, useStyles2 } from '@grafana/ui';

import { InlineRenameInput } from './InlineRenameInput';
import { SavedSearch, ValidationError } from './SavedSearches.types';

// ============================================================================
// Saved Search Item
// ============================================================================

export interface SavedSearchItemProps {
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

export function SavedSearchItem({
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
    deleteIcon: css({
      color: theme.colors.error.main,
    }),
  };
}
