import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useQueryRunner, useSceneContext } from '@grafana/scenes-react';
import { Icon, ScrollContainer, Stack, Text, useStyles2 } from '@grafana/ui';

import { AllLabelsContent } from './AllLabelsDrawer';
import { countInstances } from './SummaryStats';
import { summaryInstanceCountQuery } from './queries';
import { useLabelsBreakdown } from './useLabelsBreakdown';
import { addOrReplaceFilter, removeFilter, useFilterValue, useQueryFilter } from './utils';

export const LABELS_COLUMN_WIDTH = 250;

/**
 * Always-visible labels column rendered to the left of the main workbench content.
 * Contains a state filter (firing / pending) and the full label breakdown.
 */
export function LabelsColumn() {
  const styles = useStyles2(getStyles);
  const { labels, isLoading } = useLabelsBreakdown();

  return (
    <div className={styles.column}>
      <ScrollContainer scrollbarWidth="thin">
        <div className={styles.inner}>
          <div className={styles.section}>
            <Text weight="medium" variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.triage.state-filter-title">State</Trans>
            </Text>
            <StateFilter />
          </div>
          <div className={styles.divider} />
          <div className={styles.labelsSectionHeader}>
            <Text weight="medium" variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.triage.labels-column-title">Labels</Trans>
            </Text>
          </div>
          {!isLoading && labels.length > 0 && <AllLabelsContent allLabels={labels} />}
        </div>
      </ScrollContainer>
    </div>
  );
}

function StateFilter() {
  const styles = useStyles2(getStyles);
  const sceneContext = useSceneContext();
  const activeState = useFilterValue('alertstate');
  const counts = useInstanceCounts();

  const toggle = (value: 'firing' | 'pending') => {
    if (activeState === value) {
      removeFilter(sceneContext, 'alertstate');
    } else {
      addOrReplaceFilter(sceneContext, 'alertstate', '=', value);
    }
  };

  return (
    <Stack direction="column" gap={0.5}>
      <button
        className={cx(styles.stateButton, activeState === 'firing' && styles.stateButtonActive)}
        onClick={() => toggle('firing')}
      >
        <Icon name="exclamation-circle" size="sm" className={styles.firingIcon} />
        <span className={styles.stateLabel}>
          <Trans i18nKey="alerting.triage.state-firing">Firing</Trans>
        </span>
        {counts !== undefined && <span className={styles.stateCount}>{counts.firing}</span>}
      </button>
      <button
        className={cx(styles.stateButton, activeState === 'pending' && styles.stateButtonActive)}
        onClick={() => toggle('pending')}
      >
        <Icon name="circle" size="sm" className={styles.pendingIcon} />
        <span className={styles.stateLabel}>
          <Trans i18nKey="alerting.triage.state-pending">Pending</Trans>
        </span>
        {counts !== undefined && <span className={styles.stateCount}>{counts.pending}</span>}
      </button>
    </Stack>
  );
}

/**
 * Returns the current firing/pending instance counts based on the active query filter,
 * or undefined while the data is still loading.
 */
export function useInstanceCounts(): { firing: number; pending: number } | undefined {
  const filter = useQueryFilter();

  // Strip alertstate from filter since the instance count query adds its own alertstate matchers
  const cleanFilter = filter
    .replace(/alertstate\s*=~?\s*"(firing|pending)"[,\s]*/, '')
    .replace(/,\s*$/, '')
    .replace(/^\s*,/, '');

  const instanceDataProvider = useQueryRunner({
    queries: [summaryInstanceCountQuery(cleanFilter)],
  });

  const { data } = instanceDataProvider.useState();
  const instanceFrame = data?.series?.at(0);

  if (!instanceDataProvider.isDataReadyToDisplay() || !instanceFrame) {
    return undefined;
  }

  return countInstances(instanceFrame);
}

const getStyles = (theme: GrafanaTheme2) => ({
  column: css({
    width: LABELS_COLUMN_WIDTH,
    minWidth: LABELS_COLUMN_WIDTH,
    maxWidth: LABELS_COLUMN_WIDTH,
    marginRight: theme.spacing(2),
    borderRight: `1px solid ${theme.colors.border.weak}`,
    overflowY: 'auto',
  }),
  inner: css({
    display: 'flex',
    flexDirection: 'column',
    paddingRight: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  }),
  section: css({
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    flexShrink: 0,
  }),
  divider: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    flexShrink: 0,
  }),
  labelsSectionHeader: css({
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
    flexShrink: 0,
  }),

  stateButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: `${theme.spacing(0.5)} ${theme.spacing(0.75)}`,
    background: 'none',
    border: `1px solid transparent`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    color: theme.colors.text.primary,
    textAlign: 'left',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  stateButtonActive: css({
    background: theme.colors.action.selected,
    borderColor: theme.colors.border.medium,
  }),
  stateLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  firingIcon: css({
    color: theme.colors.error.text,
    flexShrink: 0,
  }),
  pendingIcon: css({
    color: theme.colors.warning.text,
    flexShrink: 0,
  }),
  stateCount: css({
    marginLeft: 'auto',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  }),
});
