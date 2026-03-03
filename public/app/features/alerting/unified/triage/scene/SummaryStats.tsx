import { css } from '@emotion/css';

import { DataFrameView, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner } from '@grafana/scenes-react';
import { Box, ErrorBoundaryAlert, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { summaryInstanceCountQuery, summaryRuleCountQuery } from './queries';
import { useQueryFilter } from './utils';

type AlertState = PromAlertingRuleState.Firing | PromAlertingRuleState.Pending;

interface InstanceFrame {
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

  const dfv = new DataFrameView<InstanceFrame>(frame);
  const getValue = (state: AlertState) => {
    const index = dfv.fields.alertstate.values.findIndex((s) => s === state);
    return dfv.fields.Value.values[index] ?? 0;
  };
  return {
    firing: getValue(PromAlertingRuleState.Firing),
    pending: getValue(PromAlertingRuleState.Pending),
  };
}

interface CompactStatRowProps {
  color: 'error' | 'warning';
  icon: 'exclamation-circle' | 'circle';
  ruleCount: number;
  stateLabel: AlertState;
}

function CompactStatRow({ color, icon, ruleCount, stateLabel }: CompactStatRowProps) {
  const styles = useStyles2(getCompactStatStyles);
  const iconColor = color === 'error' ? styles.errorColor : styles.warningColor;

  return (
    <div className={styles.statRow}>
      <Stack direction="row" gap={0.5} alignItems="center">
        <Icon name={icon} size="sm" className={iconColor} />
        <Text element="span" weight="medium" color={color}>
          {stateLabel === 'firing' ? (
            <Trans i18nKey="alerting.triage.compact-firing">firing</Trans>
          ) : (
            <Trans i18nKey="alerting.triage.compact-pending">pending</Trans>
          )}
        </Text>
      </Stack>
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

  const ruleDataProvider = useQueryRunner({
    queries: [summaryRuleCountQuery(cleanFilter)],
  });

  const { data: ruleData } = ruleDataProvider.useState();
  const ruleFrame = ruleData?.series?.at(0);

  if (!ruleDataProvider.isDataReadyToDisplay() || !ruleFrame) {
    return <div />;
  }

  const ruleDfv = new DataFrameView<RuleFrame>(ruleFrame);

  if (ruleDfv.length === 0) {
    return <div />;
  }

  const rules = countRules(ruleDfv);
  const hasFiring = rules.firing > 0;
  const hasPending = rules.pending > 0;

  return (
    <Box backgroundColor="secondary" borderRadius="default" padding={1.5} display="flex" alignItems="center">
      <div className={styles.statsGrid}>
        {hasFiring && (
          <CompactStatRow
            color="error"
            icon="exclamation-circle"
            ruleCount={rules.firing}
            stateLabel={PromAlertingRuleState.Firing}
          />
        )}
        {hasPending && (
          <CompactStatRow
            color="warning"
            icon="circle"
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
    gridTemplateColumns: 'max-content max-content max-content',
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
