import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { OverviewStatCards } from './OverviewStatCards';
import { type FolderCounts, type MigrationTotals, percent } from './stats';

interface GitOpsProgressProps {
  totals: MigrationTotals;
  folderCounts: FolderCounts;
}

/**
 * Overall migration progress across every resource type (dashboards, folders,
 * …). The progress bar is the collapse header — clicking it collapses the
 * per-type breakdown cards (open by default). The bar and percentage are
 * warning-coloured until everything is managed, then turn success-green at
 * 100%. The bar always shows a small amount of fill so it reads as a bar even
 * at 0%.
 */
export function GitOpsProgress({ totals, folderCounts }: GitOpsProgressProps) {
  const styles = useStyles2(getStyles);
  const [open, setOpen] = useState(true);

  const total = totals.instanceTotal + folderCounts.total;
  const managed = totals.managed + folderCounts.managed;
  const pct = total === 0 ? 0 : Math.round((managed / total) * 100);
  const complete = total > 0 && managed >= total;

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('provisioning.migrate.progress-toggle', 'Toggle migration details')}
      >
        <Icon name={open ? 'angle-down' : 'angle-right'} size="lg" />
        <div className={styles.headerBody}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Text variant="h5">
              <Trans i18nKey="provisioning.migrate.progress-title">Progress to GitOps</Trans>
            </Text>
            <Text variant="h1" color={complete ? 'success' : 'warning'}>
              {percent(managed, total)}
            </Text>
          </Stack>
          <div
            className={styles.track}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('provisioning.migrate.progress-aria', 'Progress to GitOps')}
          >
            {/* Always keep a sliver of fill so the bar is visible at 0%. */}
            <div
              className={cx(styles.fill, complete ? styles.fillComplete : styles.fillInProgress)}
              style={{ width: `max(${pct}%, ${FILL_MIN_WIDTH})` }}
            />
          </div>
          <Text variant="bodySmall" color="secondary">
            {t('provisioning.migrate.progress-summary', '{{managed}} of {{total}} resources managed', {
              managed,
              total,
            })}
          </Text>
        </div>
      </button>
      {open && (
        <div className={styles.body}>
          <OverviewStatCards totals={totals} folderCounts={folderCounts} />
        </div>
      )}
    </div>
  );
}

// Minimum visible fill width so the bar reads as a bar even at 0%.
const FILL_MIN_WIDTH = '6px';

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(3),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
  header: css({
    // Reset the native button so it can host the progress layout.
    appearance: 'none',
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    textAlign: 'left',
    cursor: 'pointer',
    color: 'inherit',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    width: '100%',
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
    },
  }),
  headerBody: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    flex: 1,
    minWidth: 0,
  }),
  body: css({
    paddingTop: theme.spacing(1),
  }),
  track: css({
    width: '100%',
    height: theme.spacing(1.5),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.canvas,
    overflow: 'hidden',
  }),
  fill: css({
    height: '100%',
    borderRadius: theme.shape.radius.pill,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'width 240ms ease',
    },
  }),
  fillInProgress: css({
    background: theme.colors.warning.main,
  }),
  fillComplete: css({
    background: theme.colors.success.main,
  }),
});
