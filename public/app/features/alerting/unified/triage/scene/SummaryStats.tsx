import { css } from '@emotion/css';

import { DataFrameView, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner } from '@grafana/scenes-react';
import { Box, ErrorBoundaryAlert, Icon, Text, useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { summaryInstanceCountQuery, summaryRuleCountQuery } from './queries';
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

export function countRules(ruleDfv: DataFrameView<RuleFrame>) {
  const counts = {
    [PromAlertingRuleState.Firing]: new Set<string>(),
    [PromAlertingRuleState.Pending]: new Set<string>(),
  };

  ruleDfv.fields.grafana_rule_uid.values.forEach((ruleUID, i) => {
    const alertstate = ruleDfv.fields.alertstate.values[i];
    counts[alertstate]?.add(ruleUID);
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

export interface InstanceCounts {
  firing: number;
  pending: number;
}

export function useInstanceCounts(): InstanceCounts | undefined {
  const filter = useQueryFilter();
  const cleanFilter = filter
    .replace(/alertstate\s*=~?\s*"(firing|pending)"[,\s]*/, '')
    .replace(/,\s*$/, '')
    .replace(/^\s*,/, '');

  const dataProvider = useQueryRunner({ queries: [summaryInstanceCountQuery(cleanFilter)] });
  const { data } = dataProvider.useState();
  const frame = data?.series?.at(0);

  if (!dataProvider.isDataReadyToDisplay() || !frame) {
    return undefined;
  }

  const dfv = new DataFrameView<Frame>(frame);
  return countInstances(dfv);
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

  const instanceDfv = new DataFrameView<Frame>(instanceFrame);
  const ruleDfv = new DataFrameView<RuleFrame>(ruleFrame);

  if (instanceDfv.length === 0 && ruleDfv.length === 0) {
    return <div />;
  }

  const instances = countInstances(instanceDfv);
  const rules = countRules(ruleDfv);
  const hasFiring = instances.firing > 0 || rules.firing > 0;
  const hasPending = instances.pending > 0 || rules.pending > 0;

  return (
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
