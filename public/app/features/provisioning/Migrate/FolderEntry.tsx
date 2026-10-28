import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { resourceKey } from './hooks/useMigrationData';
import { type FolderNode } from './tree';

interface FolderEntryProps {
  node: FolderNode;
  /** Nesting level; only root entries show the ancestor breadcrumb. */
  depth: number;
  /** UIDs of the expanded folders, shared by the whole tree. */
  expanded: Set<string>;
  selectedFolderUids: Set<string>;
  /** Composite keys (see `resourceKey`) of individually-ticked resources. */
  selectedResourceKeys: Set<string>;
  /** Composite keys of resources covered by a selected folder. */
  folderCoveredResourceKeys: Set<string>;
  onToggleExpanded: (uid: string) => void;
  onToggleFolder: (uid: string) => void;
  onToggleResource: (key: string) => void;
}

/**
 * A folder in the Resources to migrate tree: an expand toggle, a select
 * checkbox, and — when expanded — the resources that live directly inside the
 * folder followed by its subfolders. Selection is not recursive: a folder's
 * checkbox covers only the resources directly inside it, and each subfolder is
 * selected on its own. A folder with no resources of its own is shown only to
 * hold its subfolders and has no checkbox. Resources covered by a selected
 * folder are shown ticked and locked.
 */
export function FolderEntry({
  node,
  depth,
  expanded,
  selectedFolderUids,
  selectedResourceKeys,
  folderCoveredResourceKeys,
  onToggleExpanded,
  onToggleFolder,
  onToggleResource,
}: FolderEntryProps) {
  const styles = useStyles2(getStyles);
  const { row: folder, children } = node;
  const isExpanded = expanded.has(folder.uid);
  const isSelectable = folder.resourceCount > 0;
  const isSelected = isSelectable && selectedFolderUids.has(folder.uid);

  return (
    <div className={cx(styles.row, isSelected && styles.rowSelected)}>
      <div className={styles.rowHeader}>
        <IconButton
          name={isExpanded ? 'angle-down' : 'angle-right'}
          aria-label={
            isExpanded
              ? t('provisioning.migrate.resources-collapse', 'Collapse {{folder}}', { folder: folder.title })
              : t('provisioning.migrate.resources-expand', 'Expand {{folder}}', { folder: folder.title })
          }
          onClick={() => onToggleExpanded(folder.uid)}
        />
        {isSelectable && (
          <Checkbox
            value={isSelected}
            onChange={() => onToggleFolder(folder.uid)}
            aria-label={t('provisioning.migrate.resources-select-folder', 'Select folder {{folder}}', {
              folder: folder.title,
            })}
          />
        )}
        <Icon name="folder" />
        <Stack direction="column" gap={0} flex={1}>
          {depth === 0 && folder.path.length > 0 && (
            <Text variant="bodySmall" color="secondary" truncate>
              {folder.path.join(' / ')}
            </Text>
          )}
          <Text>{folder.title}</Text>
          {isSelectable && (
            <Text variant="bodySmall" color="secondary">
              {t('provisioning.migrate.resources-folder-summary', '', {
                count: folder.resourceCount,
                defaultValue_one: '{{count}} resource',
                defaultValue_other: '{{count}} resources',
              })}
            </Text>
          )}
        </Stack>
      </div>
      {isExpanded && (
        <div className={styles.children}>
          {folder.directResources.map((resource) => {
            const key = resourceKey(resource);
            const coveredByFolder = folderCoveredResourceKeys.has(key);
            const checked = coveredByFolder || selectedResourceKeys.has(key);
            return (
              <div key={`resource-${key}`} className={styles.childRow}>
                <Checkbox
                  value={checked}
                  disabled={coveredByFolder}
                  onChange={() => onToggleResource(key)}
                  aria-label={resource.title}
                />
                <Icon name={resource.kind.icon} size="sm" />
                <Text variant="bodySmall">{resource.title}</Text>
              </div>
            );
          })}
          {children.map((child) => (
            <FolderEntry
              key={child.row.uid}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedFolderUids={selectedFolderUids}
              selectedResourceKeys={selectedResourceKeys}
              folderCoveredResourceKeys={folderCoveredResourceKeys}
              onToggleExpanded={onToggleExpanded}
              onToggleFolder={onToggleFolder}
              onToggleResource={onToggleResource}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1, 1.25),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
  }),
  rowSelected: css({
    borderColor: theme.colors.primary.border,
    background: theme.colors.background.secondary,
  }),
  rowHeader: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  children: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    paddingLeft: theme.spacing(5),
    paddingTop: theme.spacing(0.75),
  }),
  childRow: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.background.canvas,
    },
  }),
});
