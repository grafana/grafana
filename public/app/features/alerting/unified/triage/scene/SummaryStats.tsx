import { css } from '@emotion/css';

import { DataFrameView, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner } from '@grafana/scenes-react';
import { Box, ErrorBoundaryAlert, Grid, Icon, type IconName, useStyles2 } from '@grafana/ui';
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

interface StatBoxProps {
  i18nKey: string;
  value: number;
  color: 'error' | 'warning';
  icon?: IconName;
  children: React.ReactNode;
}

function StatBox({ i18nKey, value, color, icon, children }: StatBoxProps) {
  const styles = useStyles2(getStatBoxStyles);
  const colorClass = color === 'error' ? styles.errorColor : styles.warningColor;

  return (
    <Box
      display="flex"
      direction="column"
      justifyContent="center"
      alignItems="center"
      padding={2}
      backgroundColor="secondary"
      borderRadius="default"
      gap={1}
      height="100%"
    >
      <div className={styles.label}>
        {icon && <Icon name={icon} size="sm" className={colorClass} />}
        {children}
      </div>
      <div className={`${styles.value} ${colorClass}`}>{value}</div>
    </Box>
  );
}

const getStatBoxStyles = (theme: GrafanaTheme2) => ({
  label: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    wordWrap: 'break-word',
    whiteSpace: 'normal',
    textAlign: 'center',
  }),
  value: css({
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1.2,
    textAlign: 'center',
  }),
  errorColor: css({
    color: theme.colors.error.text,
  }),
  warningColor: css({
    color: theme.colors.warning.text,
  }),
});

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
    <Grid gap={2}>
      {alertstateFilter.includes(PromAlertingRuleState.Firing) && (
        <Grid columns={2} gap={2}>
          <StatBox
            i18nKey="alerting.triage.firing-instances-count"
            value={instances.firing}
            color="error"
            icon="exclamation-circle"
          >
            <Trans i18nKey="alerting.triage.firing-instances-count">Firing alert instances</Trans>
          </StatBox>
          <StatBox
            i18nKey="alerting.triage.firing-rules-count"
            value={rules.firing}
            color="error"
            icon="exclamation-circle"
          >
            <Trans i18nKey="alerting.triage.rules-with-firing-instances">Alert rules with firing instances</Trans>
          </StatBox>
        </Grid>
      )}
      {alertstateFilter.includes(PromAlertingRuleState.Pending) && (
        <Grid columns={2} gap={2}>
          <StatBox
            i18nKey="alerting.triage.pending-instances-count"
            value={instances.pending}
            color="warning"
            icon="circle"
          >
            <Trans i18nKey="alerting.triage.pending-instances-count">Pending alert instances</Trans>
          </StatBox>
          <StatBox
            i18nKey="alerting.triage.rules-with-pending-instances"
            value={rules.pending}
            color="warning"
            icon="circle"
          >
            <Trans i18nKey="alerting.triage.rules-with-pending-instances">Alert rules with pending instances</Trans>
          </StatBox>
        </Grid>
      )}
    </Grid>
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
