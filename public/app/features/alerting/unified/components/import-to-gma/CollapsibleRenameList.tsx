import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CollapsableSection, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

interface RenameEntry {
  originalName: string;
  newName: string;
}

interface CollapsibleRenameListProps {
  /** Label summarizing the list, e.g. "Receivers renamed: 3" */
  label: string;
  /** Items that will be renamed */
  items: RenameEntry[];
}

/**
 * Collapsible list showing resources that will be renamed during import.
 */
function CollapsibleRenameList({ label, items }: CollapsibleRenameListProps) {
  const styles = useStyles2(getStyles);

  if (items.length === 0) {
    return null;
  }

  return (
    <CollapsableSection
      label={
        <Text variant="bodySmall" weight="medium">
          {label}
        </Text>
      }
      isOpen={false}
      className={styles.header}
      contentClassName={styles.content}
    >
      <Stack direction="column" gap={0.5}>
        {items.map(({ originalName, newName }) => (
          <Stack key={originalName} direction="row" gap={1} alignItems="center">
            <Text variant="bodySmall" color="secondary">
              {originalName}
            </Text>
            <Icon name="arrow-right" size="sm" />
            <Text variant="bodySmall">{newName}</Text>
          </Stack>
        ))}
      </Stack>
    </CollapsableSection>
  );
}

interface RenamedResourcesListProps {
  renamedReceivers: RenameEntry[];
  renamedTimeIntervals: RenameEntry[];
}

/**
 * Renders collapsible lists for both renamed receivers and time intervals.
 * Returns null if there are no renames.
 */
export function RenamedResourcesList({ renamedReceivers, renamedTimeIntervals }: RenamedResourcesListProps) {
  if (renamedReceivers.length === 0 && renamedTimeIntervals.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      <CollapsibleRenameList
        label={t('alerting.import-to-gma.renamed-receivers', '{{count}} contact points will be renamed', {
          count: renamedReceivers.length,
        })}
        items={renamedReceivers}
      />
      <CollapsibleRenameList
        label={t('alerting.import-to-gma.renamed-intervals', '{{count}} time intervals will be renamed', {
          count: renamedTimeIntervals.length,
        })}
        items={renamedTimeIntervals}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    fontSize: theme.typography.bodySmall.fontSize,
    padding: 0,
  }),
  content: css({
    padding: `0 0 0 ${theme.spacing(2.5)}`,
  }),
});
