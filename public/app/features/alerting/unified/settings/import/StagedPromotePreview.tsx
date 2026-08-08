import { css } from '@emotion/css';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { type PromoteStatsSummary } from '../../components/import-to-gma/types';

interface RenameEntry {
  originalName: string;
  newName: string;
}

interface Props {
  stats?: PromoteStatsSummary;
  renamedReceivers: RenameEntry[];
  renamedTimeIntervals: RenameEntry[];
}

/**
 * Read-only preview of a promote: what merges into the live config, and what gets renamed to avoid
 * collisions. The dry-run and the promote mutation live in the modal that renders this.
 */
export function StagedPromotePreview({ stats, renamedReceivers, renamedTimeIntervals }: Props) {
  const hasRenames = renamedReceivers.length > 0 || renamedTimeIntervals.length > 0;

  return (
    <>
      {stats && <MergePreview stats={stats} />}
      {hasRenames && <RenamedList receivers={renamedReceivers} timeIntervals={renamedTimeIntervals} />}
      <Box backgroundColor="secondary" padding={2} borderRadius="default">
        <Stack direction="row" gap={1} alignItems="flex-start">
          <Icon name="info-circle" />
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.settings.import.promote.rules-note-body">
              Alert rules and recording rules are already active as Grafana-managed rules — promote only merges the
              Alertmanager resources above.
            </Trans>
          </Text>
        </Stack>
      </Box>
    </>
  );
}

/** The "Will merge into your live config" heading + one icon row per resource type present. */
function MergePreview({ stats }: { stats: PromoteStatsSummary }) {
  return (
    <Stack direction="column" gap={1}>
      <Text weight="medium">
        <Trans i18nKey="alerting.settings.import.promote.merge-heading">Will merge into your live config:</Trans>
      </Text>
      {stats.receivers > 0 && (
        <MergeRow
          icon="comment-alt"
          count={stats.receivers}
          noun={t('alerting.settings.import.promote.merge-contact-points', '', {
            count: stats.receivers,
            defaultValue_one: 'contact point added',
            defaultValue_other: 'contact points added',
          })}
        />
      )}
      {stats.templates > 0 && (
        <MergeRow
          icon="file-alt"
          count={stats.templates}
          noun={t('alerting.settings.import.promote.merge-templates', '', {
            count: stats.templates,
            defaultValue_one: 'template added',
            defaultValue_other: 'templates added',
          })}
        />
      )}
      {stats.timeIntervals > 0 && (
        <MergeRow
          icon="history"
          count={stats.timeIntervals}
          noun={t('alerting.settings.import.promote.merge-time-intervals', '', {
            count: stats.timeIntervals,
            defaultValue_one: 'time interval added',
            defaultValue_other: 'time intervals added',
          })}
        />
      )}
      {stats.inhibitionRules > 0 && (
        <MergeRow
          icon="shield"
          count={stats.inhibitionRules}
          noun={t('alerting.settings.import.promote.merge-inhibition-rules', '', {
            count: stats.inhibitionRules,
            defaultValue_one: 'inhibition rule added',
            defaultValue_other: 'inhibition rules added',
          })}
        />
      )}
      {stats.route && (
        <MergeRow
          icon="sitemap"
          count={1}
          noun={t('alerting.settings.import.promote.merge-route', 'notification route added')}
        />
      )}
    </Stack>
  );
}

function MergeRow({ icon, count, noun }: { icon: IconName; count: number; noun: string }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.mergeRow}>
      <Icon name={icon} className={styles.addedIcon} />
      <Text>
        <strong>{count}</strong> {noun}
      </Text>
    </div>
  );
}

/** The "Renamed to avoid conflicts" section: original (struck through) → renamed. */
function RenamedList({ receivers, timeIntervals }: { receivers: RenameEntry[]; timeIntervals: RenameEntry[] }) {
  return (
    <Stack direction="column" gap={1}>
      <Text weight="medium">
        <Trans i18nKey="alerting.settings.import.promote.rename-heading">Renamed to avoid conflicts</Trans>
      </Text>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.settings.import.promote.rename-subtitle">
          These names already exist in your live config, so the imported copies are renamed.
        </Trans>
      </Text>
      {receivers.map((entry) => (
        <RenameRow
          key={`receiver-${entry.originalName}`}
          label={t('alerting.settings.import.promote.rename-contact-point', 'Contact point')}
          from={entry.originalName}
          to={entry.newName}
        />
      ))}
      {timeIntervals.map((entry) => (
        <RenameRow
          key={`time-interval-${entry.originalName}`}
          label={t('alerting.settings.import.promote.rename-time-interval', 'Time interval')}
          from={entry.originalName}
          to={entry.newName}
        />
      ))}
    </Stack>
  );
}

function RenameRow({ label, from, to }: { label: string; from: string; to: string }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.renameRow}>
      <span className={styles.renameLabel}>{label}</span>
      <span className={styles.renameFrom}>{from}</span>
      <Icon name="arrow-right" size="sm" />
      <span className={styles.renameTo}>{to}</span>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  mergeRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  addedIcon: css({
    color: theme.colors.success.text,
  }),
  renameRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  renameLabel: css({
    // Fixed label column so the original → new pairs align across rows.
    width: theme.spacing(12),
    flex: 'none',
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  renameFrom: css({
    textDecoration: 'line-through',
    color: theme.colors.text.secondary,
  }),
  renameTo: css({
    color: theme.colors.warning.text,
  }),
});
