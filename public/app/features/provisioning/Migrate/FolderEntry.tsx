import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { type FolderRow } from './hooks/useFolderMigrationData';

interface FolderEntryProps {
  folder: FolderRow;
  isExpanded: boolean;
  isSelected: boolean;
  selectedDashboardUids: Set<string>;
  folderCoveredDashboardUids: Set<string>;
  onToggleExpanded: () => void;
  onToggleFolder: () => void;
  onToggleDashboard: (uid: string) => void;
}

/**
 * A single folder row in the Resources to migrate table: an expand toggle, a
 * select checkbox, and — when expanded — the resources that live directly
 * inside the folder. Resources covered by a selected folder are shown ticked
 * and locked.
 */
export function FolderEntry({
  folder,
  isExpanded,
  isSelected,
  selectedDashboardUids,
  folderCoveredDashboardUids,
  onToggleExpanded,
  onToggleFolder,
  onToggleDashboard,
}: FolderEntryProps) {
  const styles = useStyles2(getStyles);
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
          onClick={onToggleExpanded}
        />
        <Checkbox
          value={isSelected}
          onChange={onToggleFolder}
          aria-label={t('provisioning.migrate.resources-select-folder', 'Select folder {{folder}}', {
            folder: folder.title,
          })}
        />
        <Icon name="folder" />
        <Stack direction="column" gap={0} flex={1}>
          <Text>{folder.title}</Text>
          <Text variant="bodySmall" color="secondary">
            {t('provisioning.migrate.resources-folder-summary', '', {
              count: folder.dashboardCount,
              defaultValue_one: '{{count}} resource',
              defaultValue_other: '{{count}} resources',
            })}
          </Text>
        </Stack>
      </div>
      {isExpanded && (
        <div className={styles.children}>
          {folder.directDashboards.map((dash) => {
            const coveredByFolder = folderCoveredDashboardUids.has(dash.uid);
            const checked = coveredByFolder || selectedDashboardUids.has(dash.uid);
            return (
              <div key={`dash-${dash.uid}`} className={styles.childRow}>
                <Checkbox
                  value={checked}
                  disabled={coveredByFolder}
                  onChange={() => onToggleDashboard(dash.uid)}
                  aria-label={dash.title}
                />
                <Icon name="apps" size="sm" />
                <Text variant="bodySmall">{dash.title}</Text>
              </div>
            );
          })}
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
