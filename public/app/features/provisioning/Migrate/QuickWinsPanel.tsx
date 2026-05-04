import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Checkbox, Icon, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { GETTING_STARTED_URL } from '../constants';

import { type FolderRow } from './hooks/useFolderLeaderboard';

const TOP_N = 3;

interface Props {
  folders: FolderRow[];
  repos: Repository[];
  selected: Set<string>;
  onToggle: (uid: string) => void;
  onSelectAll: () => void;
  onMigrateClick: () => void;
}

/**
 * Surfaces the top folders by unmanaged-dashboard count as one-click migration
 * targets. With no repository connected, the panel becomes a "connect your
 * first repository" prompt instead. Hidden entirely when there's a repo and
 * no unmanaged folders to surface.
 */
export function QuickWinsPanel({ folders, repos, selected, onToggle, onSelectAll, onMigrateClick }: Props) {
  const styles = useStyles2(getStyles);
  const hasRepo = repos.length > 0;

  // Eligible = unmanaged folders with at least one dashboard. The folder
  // leaderboard already orders unmanaged folders by dashboardCount desc, so
  // slicing the top N gives the highest-leverage migration targets.
  const eligibleFolders = useMemo(() => folders.filter((f) => !f.managedBy && f.dashboardCount > 0), [folders]);
  const topFolders = eligibleFolders.slice(0, TOP_N);
  const totalUnmanagedFolders = eligibleFolders.length;
  const selectedInTop = useMemo(() => topFolders.filter((f) => selected.has(f.uid)).length, [topFolders, selected]);

  if (!hasRepo) {
    return (
      <div className={styles.panel}>
        <Stack direction="row" gap={1} alignItems="center" wrap>
          <div className={styles.bolt}>
            <Icon name="bolt" size="lg" />
          </div>
          <Stack direction="column" gap={0} flex={1}>
            <Text variant="h5">
              <Trans i18nKey="provisioning.stats.quick-wins-heading-no-repo">Connect your first repository</Trans>
            </Text>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="provisioning.stats.quick-wins-subtitle-no-repo">
                Pick a Git provider, point Grafana at a repo, and the Migrate flow lights up. Until then, the dashboards
                on your instance stay where they are.
              </Trans>
            </Text>
          </Stack>
          <LinkButton variant="primary" icon="plus" href={GETTING_STARTED_URL}>
            <Trans i18nKey="provisioning.stats.quick-wins-connect-repo">Connect a repository</Trans>
          </LinkButton>
        </Stack>
      </div>
    );
  }

  if (topFolders.length === 0) {
    return null;
  }

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
          <Button variant="primary" icon="upload" onClick={onMigrateClick}>
            {ctaLabel}
          </Button>
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
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  }),
  card: css({
    flex: '1 1 220px',
    minWidth: 220,
    maxWidth: 320,
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
