import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, IconButton, Text, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/internal';
import { Indent } from 'app/core/components/Indent/Indent';

import { resourceKey } from './hooks/useMigrationData';
import { type FolderNode } from './tree';

const CHEVRON_SIZE = 'md';
const ICON_SIZE = 'sm';
const INDENT_SPACING = { xs: 1, md: 3 } as const;

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
  /** For each folder, the folders in its subtree (itself included) that hold resources. */
  subtreeUids: Map<string, string[]>;
  onSetFolderSelected: (uid: string, selected: boolean) => void;
  onToggleResource: (key: string) => void;
}

/**
 * A folder in the Resources to migrate tree. Selection is recursive: ticking a
 * folder selects every resource nested inside. A folder
 * with no resources of its own is ticked when everything beneath it is.
 */
export function FolderEntry({
  node,
  depth,
  expanded,
  selectedFolderUids,
  selectedResourceKeys,
  folderCoveredResourceKeys,
  onToggleExpanded,
  subtreeUids,
  onSetFolderSelected,
  onToggleResource,
}: FolderEntryProps) {
  const styles = useStyles2(getStyles);
  const { row: folder, children } = node;
  const isExpanded = expanded.has(folder.uid);
  const coveredUids = subtreeUids.get(folder.uid) ?? [];
  // A folder with resources of its own has its own state. A folder that only
  // holds subfolders is ticked when everything beneath it is.
  const isSelected =
    folder.resourceCount > 0
      ? selectedFolderUids.has(folder.uid)
      : coveredUids.length > 0 && coveredUids.every((uid) => selectedFolderUids.has(uid));

  return (
    <>
      <div className={styles.row}>
        <div className={styles.checkboxCell}>
          {coveredUids.length > 0 ? (
            <Checkbox
              value={isSelected}
              onChange={() => onSetFolderSelected(folder.uid, !isSelected)}
              aria-label={t('provisioning.migrate.resources-select-folder', 'Select folder {{folder}}', {
                folder: folder.title,
              })}
            />
          ) : (
            <span className={styles.checkboxSpacer} />
          )}
        </div>
        <Indent level={depth} spacing={INDENT_SPACING} />
        <IconButton
          size={CHEVRON_SIZE}
          className={styles.chevron}
          name={isExpanded ? 'angle-down' : 'angle-right'}
          aria-label={
            isExpanded
              ? t('provisioning.migrate.resources-collapse', 'Collapse {{folder}}', { folder: folder.title })
              : t('provisioning.migrate.resources-expand', 'Expand {{folder}}', { folder: folder.title })
          }
          onClick={() => onToggleExpanded(folder.uid)}
        />
        <div className={styles.iconNameContainer}>
          <Icon size={ICON_SIZE} name={isExpanded ? 'folder-open' : 'folder'} />
          <Text truncate>{folder.title}</Text>
          {folder.resourceCount > 0 && (
            <Text variant="bodySmall" color="secondary" truncate>
              {t('provisioning.migrate.resources-folder-summary', '', {
                count: folder.resourceCount,
                defaultValue_one: '{{count}} resource',
                defaultValue_other: '{{count}} resources',
              })}
            </Text>
          )}
          {depth === 0 && folder.path.length > 0 && (
            <Text variant="bodySmall" color="secondary" truncate>
              {folder.path.join(' / ')}
            </Text>
          )}
        </div>
      </div>
      {isExpanded && (
        <>
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
              subtreeUids={subtreeUids}
              onSetFolderSelected={onSetFolderSelected}
              onToggleResource={onToggleResource}
            />
          ))}
          {folder.directResources.map((resource) => {
            const key = resourceKey(resource);
            const coveredByFolder = folderCoveredResourceKeys.has(key);
            const checked = coveredByFolder || selectedResourceKeys.has(key);
            return (
              <div key={`resource-${key}`} className={styles.row}>
                <div className={styles.checkboxCell}>
                  <Checkbox
                    value={checked}
                    disabled={coveredByFolder}
                    onChange={() => onToggleResource(key)}
                    aria-label={resource.title}
                  />
                </div>
                <Indent level={depth + 1} spacing={INDENT_SPACING} />
                <span className={styles.chevronSpacer} />
                <div className={styles.iconNameContainer}>
                  <Icon size={ICON_SIZE} name={resource.kind.icon} />
                  <Text truncate>{resource.title}</Text>
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    height: 36,
    padding: theme.spacing(0, 1),
    gap: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  checkboxCell: css({
    display: 'flex',
    alignItems: 'center',
  }),
  // Same width as a checkbox so rows without one still line up.
  checkboxSpacer: css({
    paddingLeft: theme.spacing(2),
  }),
  chevron: css({
    marginRight: theme.spacing(1),
    width: getSvgSize(CHEVRON_SIZE),
  }),
  // Same width as the chevron so resource names line up with folder names.
  chevronSpacer: css({
    paddingLeft: `calc(${getSvgSize(CHEVRON_SIZE)}px + ${theme.spacing(1)})`,
  }),
  iconNameContainer: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
    overflow: 'hidden',
    minWidth: 0,
  }),
});
