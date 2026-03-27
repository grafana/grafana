import { css, cx } from '@emotion/css';
import { useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useQueryRunner, useSceneContext } from '@grafana/scenes-react';
import { FilterInput, Icon, ScrollContainer, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { countInstances } from '../SummaryStats';
import { summaryInstanceCountQuery } from '../queries';
import { useLabelsBreakdown } from '../useLabelsBreakdown';
import { addOrReplaceFilter, removeFilter, useFilterValue, useQueryFilter } from '../utils';

import { AllLabelsContent } from './LabelsContent';

export const LABELS_COLUMN_WIDTH = 250;
const COLLAPSED_WIDTH = 36;

/**
 * Always-visible labels column rendered to the left of the main workbench content.
 * Contains a state filter (firing / pending) and the full label breakdown.
 */
export function LabelsColumn() {
  const { labels, isLoading } = useLabelsBreakdown();
  const [open, toggleOpen] = useToggle(true);
  const [labelFilter, setLabelFilter] = useState('');
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.column, !open && styles.columnCollapsed)}>
      <div className={styles.collapseButtonRow}>
        <Tooltip
          content={
            open
              ? t('alerting.triage.collapse-sidebar', 'Collapse sidebar')
              : t('alerting.triage.expand-sidebar', 'Expand sidebar')
          }
          placement="right"
        >
          <button
            className={styles.collapseButton}
            onClick={toggleOpen}
            aria-label={
              open
                ? t('alerting.triage.collapse-sidebar', 'Collapse sidebar')
                : t('alerting.triage.expand-sidebar', 'Expand sidebar')
            }
          >
            <Icon name={open ? 'angle-left' : 'angle-right'} size="sm" />
          </button>
        </Tooltip>
      </div>
      {open && (
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
              <FilterInput
                placeholder={t('alerting.triage.filter-labels-placeholder', 'Filter')}
                value={labelFilter}
                onChange={setLabelFilter}
                aria-label={t('alerting.triage.filter-labels', 'Filter labels')}
                className={styles.labelFilterInput}
              />
            </div>
            {!isLoading && labels.length > 0 && <AllLabelsContent allLabels={labels} labelFilter={labelFilter} />}
          </div>
        </ScrollContainer>
      )}
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
    display: 'flex',
    flexDirection: 'column',
  }),
  columnCollapsed: css({
    width: COLLAPSED_WIDTH,
    minWidth: COLLAPSED_WIDTH,
    maxWidth: COLLAPSED_WIDTH,
    borderRight: 'none',
  }),
  collapseButtonRow: css({
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0.5),
    flexShrink: 0,
  }),
  collapseButton: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    padding: 0,
    background: 'none',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    color: theme.colors.text.secondary,
    flexShrink: 0,
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  inner: css({
    display: 'flex',
    flexDirection: 'column',
    paddingRight: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  }),
  section: css({
    padding: theme.spacing(1, 1.5),
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
    padding: theme.spacing(1, 0, 1, 1.5),
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  }),
  labelFilterInput: css({
    width: '100%',
  }),
  stateButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0.5, 0.75),
    background: 'none',
    border: `1px solid transparent`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    color: theme.colors.text.secondary,
    textAlign: 'left',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  stateButtonActive: css({
    background: theme.colors.action.selected,
  }),
  stateLabel: css({
    color: theme.colors.text.secondary,
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
