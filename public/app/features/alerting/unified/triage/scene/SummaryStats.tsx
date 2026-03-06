import { css } from '@emotion/css';
import { useState } from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner, useSceneContext } from '@grafana/scenes-react';
import { Box, Button, Divider, ErrorBoundaryAlert, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { FIELD_NAMES } from '../constants';

import { AllLabelsDrawer } from './AllLabelsDrawer';
import { LabelBadgeCounts } from './BadgeCounts';
import { normalizeFrame } from './dataTransform';
import { summaryInstanceCountQuery, summaryRuleCountQuery } from './queries';
import { type LabelStats, useLabelsBreakdown } from './useLabelsBreakdown';
import { addOrReplaceFilter, useQueryFilter } from './utils';

const PREVIEW_LABEL_COUNT = 5;

type AlertState = PromAlertingRuleState.Firing | PromAlertingRuleState.Pending;

export function countRules(ruleFrame: DataFrame) {
  const ruleUIDField = ruleFrame.fields.find((f) => f.name === FIELD_NAMES.grafanaRuleUID);
  const alertstateField = ruleFrame.fields.find((f) => f.name === FIELD_NAMES.alertstate);

  if (!ruleUIDField || !alertstateField) {
    return { firing: 0, pending: 0 };
  }

  const counts = {
    [PromAlertingRuleState.Firing]: new Set<string>(),
    [PromAlertingRuleState.Pending]: new Set<string>(),
  };

  ruleUIDField.values.forEach((ruleUID: string, i: number) => {
    const alertstate: AlertState = alertstateField.values[i];
    counts[alertstate]?.add(ruleUID);
  });

  return {
    firing: counts[PromAlertingRuleState.Firing].size,
    pending: counts[PromAlertingRuleState.Pending].size,
  };
}

export function countInstances(instanceFrame: DataFrame) {
  const frame = normalizeFrame(instanceFrame);
  const alertstateField = frame.fields.find((f) => f.name === FIELD_NAMES.alertstate);
  const valueField = frame.fields.find((f) => f.name === FIELD_NAMES.value);

  if (!alertstateField || !valueField) {
    return { firing: 0, pending: 0 };
  }

  const getValue = (state: AlertState) => {
    const index = alertstateField.values.findIndex((s: string) => s === state);
    return valueField.values[index] ?? 0;
  };
  return { firing: getValue(PromAlertingRuleState.Firing), pending: getValue(PromAlertingRuleState.Pending) };
}

interface CompactStatRowProps {
  color: 'error' | 'warning';
  icon: 'exclamation-circle' | 'circle';
  instanceCount: number;
  ruleCount: number;
  stateLabel: AlertState;
}

function CompactStatRow({ color, icon, instanceCount, ruleCount, stateLabel }: CompactStatRowProps) {
  const styles = useStyles2(getCompactStatStyles);
  const iconColor = color === 'error' ? styles.errorColor : styles.warningColor;

  return (
    <div className={styles.statRow}>
      <Icon name={icon} size="sm" className={iconColor} />
      <Text element="span" weight="medium" color={color}>
        {stateLabel === 'firing' ? (
          <Trans i18nKey="alerting.triage.compact-firing">firing</Trans>
        ) : (
          <Trans i18nKey="alerting.triage.compact-pending">pending</Trans>
        )}
      </Text>
      <span className={`${styles.statValue} ${iconColor}`}>{instanceCount}</span>
      <Text element="span" color="secondary" variant="bodySmall">
        <Trans i18nKey="alerting.triage.compact-instances">instances</Trans>
      </Text>
      <span className={`${styles.statValue} ${iconColor}`}>{ruleCount}</span>
      <Text element="span" color="secondary" variant="bodySmall">
        <Trans i18nKey="alerting.triage.compact-rules">rules</Trans>
      </Text>
    </div>
  );
}

const TOOLTIP_MAX_VALUES = 10;

function LabelTooltipContent({ label }: { label: LabelStats }) {
  const visibleValues = label.values.slice(0, TOOLTIP_MAX_VALUES);
  const hiddenCount = label.values.length - visibleValues.length;

  return (
    <Box padding={0.5}>
      <Box marginBottom={0.5}>
        <Stack direction="row" gap={1} alignItems="center">
          <Text weight="bold">{label.key}</Text>
          <LabelBadgeCounts firing={label.firing} pending={label.pending} />
        </Stack>
      </Box>
      <Divider spacing={0.5} />
      {visibleValues.map(({ value, firing, pending }) => (
        <Stack key={value} direction="row" justifyContent="space-between" gap={2}>
          <span>{value}</span>
          <LabelBadgeCounts firing={firing} pending={pending} />
        </Stack>
      ))}
      {hiddenCount > 0 && (
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="alerting.triage.tooltip-more-values" values={{ count: hiddenCount }}>
            {'and {{ count }} more'}
          </Trans>
        </Text>
      )}
    </Box>
  );
}

function LabelStatsSection() {
  const styles = useStyles2(getLabelStatsStyles);
  const { labels, isLoading } = useLabelsBreakdown();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const sceneContext = useSceneContext();

  const topLabels = labels.slice(0, PREVIEW_LABEL_COUNT);

  if (isLoading || topLabels.length === 0) {
    return null;
  }

  const hiddenCount = labels.length - topLabels.length;

  return (
    <Stack direction="column" gap={1}>
      <Stack justifyContent="space-between" alignItems="center">
        <Text weight="medium">
          <Trans i18nKey="alerting.triage.high-activity-labels">High Activity Labels</Trans>
        </Text>
        <Button variant="secondary" fill="outline" size="sm" onClick={() => setIsDrawerOpen(true)}>
          <Trans i18nKey="alerting.triage.all-labels">All labels</Trans>
        </Button>
      </Stack>
      <Stack gap={1} wrap="wrap" alignItems="center">
        {topLabels.map((label) => (
          <Tooltip key={label.key} content={<LabelTooltipContent label={label} />} interactive>
            <button
              className={styles.labelBadge}
              type="button"
              onClick={() => addOrReplaceFilter(sceneContext, label.key, '=~', '.+')}
            >
              <span>{label.key}</span>
              <LabelBadgeCounts firing={label.firing} pending={label.pending} />
            </button>
          </Tooltip>
        ))}
        {hiddenCount > 0 && (
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="alerting.triage.hidden-label-count" values={{ count: hiddenCount }}>
              {'and {{ count }} more'}
            </Trans>
          </Text>
        )}
      </Stack>
      {isDrawerOpen && <AllLabelsDrawer allLabels={labels} onClose={() => setIsDrawerOpen(false)} />}
    </Stack>
  );
}

function SummaryStatsContent() {
  const styles = useStyles2(getCompactStatStyles);
  const filter = useQueryFilter();

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

  if (instanceFrame.length === 0 && ruleFrame.length === 0) {
    return <div />;
  }

  const instances = countInstances(instanceFrame);
  const rules = countRules(ruleFrame);
  const hasFiring = instances.firing > 0 || rules.firing > 0;
  const hasPending = instances.pending > 0 || rules.pending > 0;

  return (
    <Stack direction="column" gap={2}>
      <Box backgroundColor="secondary" borderRadius="default" padding={1.5}>
        <div className={styles.statsGrid}>
          {hasFiring && (
            <CompactStatRow
              color="error"
              icon="exclamation-circle"
              instanceCount={instances.firing}
              ruleCount={rules.firing}
              stateLabel={PromAlertingRuleState.Firing}
            />
          )}
          {hasPending && (
            <CompactStatRow
              color="warning"
              icon="circle"
              instanceCount={instances.pending}
              ruleCount={rules.pending}
              stateLabel={PromAlertingRuleState.Pending}
            />
          )}
        </div>
      </Box>
      <ErrorBoundaryAlert style="alertbox">
        <LabelStatsSection />
      </ErrorBoundaryAlert>
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
  statsGrid: css({
    display: 'grid',
    gridTemplateColumns: 'max-content max-content max-content max-content max-content max-content',
    alignItems: 'center',
    columnGap: theme.spacing(1.5),
    rowGap: theme.spacing(0.5),
    fontSize: theme.typography.body.fontSize,
  }),
  statRow: css({
    gridColumn: '1 / -1',
    display: 'grid',
    gridTemplateColumns: 'subgrid',
    alignItems: 'center',
  }),
  statValue: css({
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.h4.fontSize,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  }),
  errorColor: css({
    color: theme.colors.error.text,
  }),
  warningColor: css({
    color: theme.colors.warning.text,
  }),
});

const getLabelStatsStyles = (theme: GrafanaTheme2) => ({
  labelBadge: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
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
});
