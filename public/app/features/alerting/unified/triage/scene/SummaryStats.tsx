import { css } from '@emotion/css';
import { useState } from 'react';

import { DataFrameView, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { AdHocFiltersVariable, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { useQueryRunner, useSceneContext } from '@grafana/scenes-react';
import {
  Box,
  Button,
  Drawer,
  ErrorBoundaryAlert,
  Icon,
  LoadingPlaceholder,
  Stack,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { VARIABLES } from '../constants';

import { summaryInstanceCountQuery, summaryRuleCountQuery } from './queries';
import { type LabelValueCount, type TopLabel, useAllLabels, useTopLabels } from './useTopLabels';
import { useQueryFilter } from './utils';

type AlertState = PromAlertingRuleState.Firing | PromAlertingRuleState.Pending;

interface Frame {
  alertstate: AlertState;
  Value: number;
}

export interface RuleFrame {
  alertstate: AlertState;
  alertname: string;
  grafana_folder: string;
  grafana_rule_uid: string;
  Value: number;
}

export function parseAlertstateFilter(filter: string): AlertState[] {
  const hasFiring = filter.match(/alertstate\s*=~?\s*"firing"/);
  const hasPending = filter.match(/alertstate\s*=~?\s*"pending"/);

  const states: AlertState[] = [];

  // If both or neither match, include both states
  if ((hasFiring && hasPending) || (!hasFiring && !hasPending)) {
    return [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending];
  }

  if (hasFiring) {
    states.push(PromAlertingRuleState.Firing);
  }
  if (hasPending) {
    states.push(PromAlertingRuleState.Pending);
  }

  return states;
}

export function countRules(ruleDfv: DataFrameView<RuleFrame>, alertstateFilter: AlertState[]) {
  const counts = {
    [PromAlertingRuleState.Firing]: new Set<string>(),
    [PromAlertingRuleState.Pending]: new Set<string>(),
  };

  // Only count rules for states we're interested in
  ruleDfv.fields.grafana_rule_uid.values.forEach((ruleUID, i) => {
    const alertstate = ruleDfv.fields.alertstate.values[i];
    if (alertstateFilter.includes(alertstate)) {
      counts[alertstate].add(ruleUID);
    }
  });

  return {
    firing: counts[PromAlertingRuleState.Firing].size,
    pending: counts[PromAlertingRuleState.Pending].size,
  };
}

function countInstances(instanceDfv: DataFrameView<Frame>) {
  const getValue = (state: AlertState) => {
    const index = instanceDfv.fields.alertstate.values.findIndex((s) => s === state);
    return instanceDfv.fields.Value.values[index] ?? 0;
  };
  return { firing: getValue(PromAlertingRuleState.Firing), pending: getValue(PromAlertingRuleState.Pending) };
}

interface CompactStatRowProps {
  color: 'error' | 'warning';
  icon: 'exclamation-circle' | 'circle';
  instanceCount: number;
  ruleCount: number;
  stateLabel: string;
}

function CompactStatRow({ color, icon, instanceCount, ruleCount, stateLabel }: CompactStatRowProps) {
  const styles = useStyles2(getCompactStatStyles);
  const colorClass = color === 'error' ? styles.errorColor : styles.warningColor;

  return (
    <div className={styles.statRow}>
      <Icon name={icon} size="sm" className={colorClass} />
      <span className={`${styles.statValue} ${colorClass}`}>{instanceCount}</span>
      <span className={styles.statLabel}>
        <Trans i18nKey={`alerting.triage.compact-${stateLabel}-instances`}>{stateLabel} instances</Trans>
      </span>
      <span className={styles.separator}>|</span>
      <span className={`${styles.statValue} ${colorClass}`}>{ruleCount}</span>
      <span className={styles.statLabel}>
        <Trans i18nKey={`alerting.triage.compact-${stateLabel}-rules`}>rules</Trans>
      </span>
    </div>
  );
}

function LabelTooltipContent({ label }: { label: TopLabel }) {
  const styles = useStyles2(getTooltipStyles);

  return (
    <div className={styles.tooltipContainer}>
      <div className={styles.tooltipHeader}>
        <Trans i18nKey="alerting.triage.top-label-tooltip-header" values={{ key: label.key, count: label.count }}>
          {'{{ key }} ({{ count }} instances)'}
        </Trans>
      </div>
      <div className={styles.tooltipDivider} />
      {label.values.map(({ value, count }) => (
        <div key={value} className={styles.tooltipRow}>
          <span className={styles.tooltipValue}>{value}</span>
          <span className={styles.tooltipCount}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function TopLabelsSection() {
  const styles = useStyles2(getTopLabelsStyles);
  const { topLabels, isLoading } = useTopLabels();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (isLoading || topLabels.length === 0) {
    return null;
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <Trans i18nKey="alerting.triage.top-labels">Top labels</Trans>
      </div>
      <Stack gap={1} wrap="wrap">
        {topLabels.map((label) => (
          <Tooltip key={label.key} content={<LabelTooltipContent label={label} />} interactive>
            <button className={styles.labelBadge} type="button">
              {label.key}: {label.count}
            </button>
          </Tooltip>
        ))}
        <button className={styles.moreBadge} type="button" onClick={() => setIsDrawerOpen(true)}>
          <Trans i18nKey="alerting.triage.more-labels">More…</Trans>
        </button>
      </Stack>
      {isDrawerOpen && <AllLabelsDrawer onClose={() => setIsDrawerOpen(false)} />}
    </div>
  );
}

interface AllLabelsDrawerProps {
  onClose: () => void;
}

const DEFAULT_VISIBLE_LABELS = 12;
const DEFAULT_VISIBLE_VALUES = 12;

interface LabelValuesListProps {
  values: LabelValueCount[];
  onValueClick: (value: string) => void;
}

function LabelValuesList({ values, onValueClick }: LabelValuesListProps) {
  const styles = useStyles2(getDrawerStyles);
  const [expanded, setExpanded] = useState(false);

  const visibleValues = expanded ? values : values.slice(0, DEFAULT_VISIBLE_VALUES);
  const hasMore = values.length > DEFAULT_VISIBLE_VALUES;

  return (
    <div className={styles.valuesList}>
      {visibleValues.map(({ value, count }) => (
        <button key={value} type="button" className={styles.valueRow} onClick={() => onValueClick(value)}>
          <span className={styles.valueName}>{value}</span>
          <span className={styles.valueCount}>{count}</span>
        </button>
      ))}
      {hasMore && !expanded && (
        <Button variant="secondary" fill="text" onClick={() => setExpanded(true)}>
          <Trans
            i18nKey="alerting.triage.show-all-values"
            values={{ count: values.length }}
            defaults={'Show all ({{ count }})'}
          />
        </Button>
      )}
    </div>
  );
}

function AllLabelsDrawer({ onClose }: AllLabelsDrawerProps) {
  const styles = useStyles2(getDrawerStyles);
  const { allLabels, isLoading } = useAllLabels();
  const sceneContext = useSceneContext();
  const [showAll, setShowAll] = useState(false);

  const visibleLabels = showAll ? allLabels : allLabels.slice(0, DEFAULT_VISIBLE_LABELS);
  const hasMore = allLabels.length > DEFAULT_VISIBLE_LABELS;

  const handleValueClick = (key: string, value: string) => {
    const filtersVariable = sceneGraph.lookupVariable(VARIABLES.filters, sceneContext);
    if (filtersVariable instanceof AdHocFiltersVariable) {
      const currentFilters = filtersVariable.state.filters;
      const existingIndex = currentFilters.findIndex((f) => f.key === key);

      const newFilter = { key, operator: '=', value };
      const updatedFilters =
        existingIndex >= 0
          ? currentFilters.map((f, i) => (i === existingIndex ? { ...f, value } : f))
          : [...currentFilters, newFilter];

      filtersVariable.setState({ filters: updatedFilters });
    }
    onClose();
  };

  return (
    <Drawer title={t('alerting.triage.all-labels-drawer-title', 'All labels')} size="sm" onClose={onClose}>
      {isLoading ? (
        <LoadingPlaceholder text={t('alerting.triage.loading-labels', 'Loading labels…')} />
      ) : (
        <div className={styles.drawerContent}>
          {visibleLabels.map((label) => (
            <div key={label.key} className={styles.labelSection}>
              <div className={styles.labelHeader}>
                {label.key}{' '}
                <span className={styles.labelCount}>
                  <Trans
                    i18nKey="alerting.triage.label-instance-count"
                    values={{ count: label.count }}
                    defaults={'({{ count }} instances)'}
                  />
                </span>
              </div>
              <LabelValuesList values={label.values} onValueClick={(value) => handleValueClick(label.key, value)} />
            </div>
          ))}
          {hasMore && !showAll && (
            <Button variant="secondary" fill="text" onClick={() => setShowAll(true)}>
              <Trans
                i18nKey="alerting.triage.show-all-labels"
                values={{ count: allLabels.length }}
                defaults={'Show all ({{ count }})'}
              />
            </Button>
          )}
        </div>
      )}
    </Drawer>
  );
}

function SummaryStatsContent() {
  const filter = useQueryFilter();
  const alertstateFilter = parseAlertstateFilter(filter);

  // Strip alertstate from filter since the dedup queries add their own alertstate matchers
  const cleanFilter = filter
    .replace(/alertstate\s*=~?\s*"(firing|pending)"[,\s]*/, '')
    .replace(/,\s*$/, '')
    .replace(/^\s*,/, '');

  const instanceDataProvider = useQueryRunner({
    queries: [summaryInstanceCountQuery(cleanFilter)],
  });

  const ruleDataProvider = useQueryRunner({
    queries: [summaryRuleCountQuery(cleanFilter)],
  });

  const { data: instanceData } = instanceDataProvider.useState();
  const { data: ruleData } = ruleDataProvider.useState();
  const instanceFrame = instanceData?.series?.at(0);
  const ruleFrame = ruleData?.series?.at(0);

  if (
    !instanceDataProvider.isDataReadyToDisplay() ||
    !ruleDataProvider.isDataReadyToDisplay() ||
    !instanceFrame ||
    !ruleFrame
  ) {
    return <div />;
  }

  const instanceDfv = new DataFrameView<Frame>(instanceFrame);
  const ruleDfv = new DataFrameView<RuleFrame>(ruleFrame);

  if (instanceDfv.length === 0 && ruleDfv.length === 0) {
    return <div />;
  }

  const instances = countInstances(instanceDfv);
  const rules = countRules(ruleDfv, alertstateFilter);

  return (
    <Stack direction="column" gap={2}>
      <Box backgroundColor="secondary" borderRadius="default" padding={1.5}>
        <Stack direction="column" gap={0.5}>
          {alertstateFilter.includes(PromAlertingRuleState.Firing) && (
            <CompactStatRow
              color="error"
              icon="exclamation-circle"
              instanceCount={instances.firing}
              ruleCount={rules.firing}
              stateLabel="firing"
            />
          )}
          {alertstateFilter.includes(PromAlertingRuleState.Pending) && (
            <CompactStatRow
              color="warning"
              icon="circle"
              instanceCount={instances.pending}
              ruleCount={rules.pending}
              stateLabel="pending"
            />
          )}
        </Stack>
      </Box>
      <TopLabelsSection />
    </Stack>
  );
}

export function SummaryStatsReact() {
  return (
    <ErrorBoundaryAlert>
      <SummaryStatsContent />
    </ErrorBoundaryAlert>
  );
}

// simple wrapper so we can render the Chart using a Scene parent
export class SummaryStatsScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryStatsReact;
}

const getCompactStatStyles = (theme: GrafanaTheme2) => ({
  statRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    fontSize: theme.typography.body.fontSize,
  }),
  statValue: css({
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.h4.fontSize,
  }),
  statLabel: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  separator: css({
    color: theme.colors.text.disabled,
  }),
  errorColor: css({
    color: theme.colors.error.text,
  }),
  warningColor: css({
    color: theme.colors.warning.text,
  }),
});

const getTooltipStyles = (theme: GrafanaTheme2) => ({
  tooltipContainer: css({
    padding: theme.spacing(0.5),
    minWidth: 160,
  }),
  tooltipHeader: css({
    fontWeight: theme.typography.fontWeightBold,
    marginBottom: theme.spacing(0.5),
  }),
  tooltipDivider: css({
    borderBottom: `1px solid ${theme.colors.border.medium}`,
    marginBottom: theme.spacing(0.5),
  }),
  tooltipRow: css({
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    padding: `${theme.spacing(0.25)} 0`,
  }),
  tooltipValue: css({
    color: theme.colors.text.primary,
  }),
  tooltipCount: css({
    color: theme.colors.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  }),
});

const getTopLabelsStyles = (theme: GrafanaTheme2) => ({
  sectionHeader: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(0.5),
  }),
  labelBadge: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${theme.spacing(0.25)} ${theme.spacing(1)}`,
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.pill,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    whiteSpace: 'nowrap',

    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  moreBadge: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${theme.spacing(0.25)} ${theme.spacing(1)}`,
    backgroundColor: 'transparent',
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.pill,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    whiteSpace: 'nowrap',

    '&:hover': {
      backgroundColor: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
});

const getDrawerStyles = (theme: GrafanaTheme2) => ({
  drawerContent: css({
    display: 'flex',
    flexDirection: 'column' as const,
    gap: theme.spacing(2),
  }),
  labelSection: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(1.5),
  }),
  labelHeader: css({
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.body.fontSize,
    marginBottom: theme.spacing(0.5),
  }),
  labelCount: css({
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightRegular,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  valuesList: css({
    display: 'flex',
    flexDirection: 'column' as const,
  }),
  valueRow: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'left' as const,

    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  valueName: css({
    color: theme.colors.text.primary,
  }),
  valueCount: css({
    color: theme.colors.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  }),
});
