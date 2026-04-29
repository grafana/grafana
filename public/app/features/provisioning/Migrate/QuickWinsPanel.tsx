import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Checkbox, Icon, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { GETTING_STARTED_URL, PROVISIONING_URL } from '../constants';

import { type FolderRow } from './hooks/useFolderLeaderboard';

const TOP_N = 3;

function migrateTarget(repos: Repository[]): string {
  if (repos.length === 0) {
    return GETTING_STARTED_URL;
  }
  if (repos.length === 1 && repos[0].metadata?.name) {
    return `${PROVISIONING_URL}/${repos[0].metadata.name}`;
  }
  return PROVISIONING_URL;
}

interface Props {
  folders: FolderRow[];
  repos: Repository[];
  selected: Set<string>;
  onToggle: (uid: string) => void;
  onSelectAll: () => void;
}

/**
 * Surfaces the top folders by unmanaged-dashboard count as one-click migration
 * targets. Hidden when no unmanaged folders exist — the rest of the page
 * already handles the empty state.
 */
export function QuickWinsPanel({ folders, repos, selected, onToggle, onSelectAll }: Props) {
  const styles = useStyles2(getStyles);

  const topFolders = useMemo(
    () => folders.filter((f) => f.unmanagedDashboardCount > 0).slice(0, TOP_N),
    [folders]
  );
  const totalUnmanagedFolders = useMemo(
    () => folders.filter((f) => f.unmanagedDashboardCount > 0).length,
    [folders]
  );
  const selectedInTop = useMemo(
    () => topFolders.filter((f) => selected.has(f.uid)).length,
    [topFolders, selected]
  );

  if (topFolders.length === 0) {
    return null;
  }

  const target = migrateTarget(repos);
  const ctaLabel =
    selectedInTop > 0
      ? t('provisioning.stats.quick-wins-cta-selected', 'Migrate selected ({{count}})', { count: selectedInTop })
      : t('provisioning.stats.quick-wins-cta-default', 'Migrate top {{count}}', { count: topFolders.length });

  return (
    <div className={styles.panel}>
      <Stack direction="row" gap={1} alignItems="center" wrap>
        <div className={styles.bolt}>
          <Icon name="bolt" size="lg" />
        </div>
        <Stack direction="column" gap={0}>
          <Text variant="h5">
            <Trans i18nKey="provisioning.stats.quick-wins-heading">Quick wins</Trans>
          </Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.quick-wins-subtitle">
              Start with these folders to get value quickly. They are good candidates for Git Sync.
            </Trans>
          </Text>
        </Stack>
        <div className={styles.spacer} />
        <Stack direction="column" gap={0.5} alignItems="flex-end">
          <LinkButton variant="primary" icon="upload" href={target}>
            {ctaLabel}
          </LinkButton>
          {totalUnmanagedFolders > topFolders.length && (
            <TextLink href="#folders-to-migrate" variant="bodySmall" onClick={onSelectAll}>
              {t('provisioning.stats.quick-wins-select-all', 'Select all {{count}} folders', {
                count: totalUnmanagedFolders,
              })}
            </TextLink>
          )}
        </Stack>
      </Stack>
      <div className={styles.cards}>
        {topFolders.map((folder) => {
          const isSelected = selected.has(folder.uid);
          const isClean = folder.managedDashboardCount === 0;
          return (
            <button
              key={folder.uid}
              type="button"
              className={styles.card}
              aria-pressed={isSelected}
              onClick={() => onToggle(folder.uid)}
            >
              <Stack direction="row" gap={1} alignItems="center">
                <Checkbox value={isSelected} onChange={() => onToggle(folder.uid)} aria-label={folder.title} />
                <Icon name="folder" />
                <Stack direction="column" gap={0}>
                  <Text variant="body" weight="medium">
                    {folder.title}
                  </Text>
                  <Text variant="bodySmall" color="secondary">
                    {t('provisioning.stats.quick-wins-dashboard-count', '{{count}} dashboards', {
                      count: folder.dashboardCount,
                    })}
                  </Text>
                </Stack>
                <div className={styles.spacer} />
                {isClean && (
                  <Badge color="green" text={t('provisioning.stats.quick-wins-clean-badge', 'Clean')} />
                )}
              </Stack>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.info.borderTransparent}`,
    background: theme.colors.info.transparent,
  }),
  bolt: css({
    width: theme.spacing(4),
    height: theme.spacing(4),
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.info.main,
    color: theme.colors.info.contrastText,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
  }),
  spacer: css({
    flex: '1 1 auto',
  }),
  cards: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(1),
  }),
  card: css({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'border-color 120ms ease, background 120ms ease',
    },
    '&:hover, &:focus-visible': {
      borderColor: theme.colors.border.medium,
      background: theme.colors.background.secondary,
    },
    '&[aria-pressed="true"]': {
      borderColor: theme.colors.primary.border,
      background: theme.colors.background.secondary,
    },
  }),
});
