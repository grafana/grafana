import { DataFrameView } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner } from '@grafana/scenes-react';
import { ErrorBoundaryAlert, Stack, Text } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { Spacer } from '../../components/Spacer';
import { METRIC_NAME } from '../constants';

import { getDataQuery, useQueryFilter } from './utils';

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

export function parseAlertstateFilter(filter: string): AlertState | null {
  const firingMatch = filter.match(/alertstate\s*=~?\s*"firing"/);
  const pendingMatch = filter.match(/alertstate\s*=~?\s*"pending"/);

  if (firingMatch && pendingMatch) {
    return null;
  }

  if (firingMatch) {
    return PromAlertingRuleState.Firing;
  }

  if (pendingMatch) {
    return PromAlertingRuleState.Pending;
  }

  return null;
}

export function countRules(ruleDfv: DataFrameView<RuleFrame>, alertstateFilter: AlertState | null) {
  const rulesWithFiring = new Set<string>();
  const rulesWithPending = new Set<string>();

  ruleDfv.fields.grafana_rule_uid.values.forEach((ruleUID, i) => {
    const alertstate = ruleDfv.fields.alertstate.values[i];
    if (alertstate === PromAlertingRuleState.Firing) {
      rulesWithFiring.add(ruleUID);
    }
    if (alertstate === PromAlertingRuleState.Pending) {
      rulesWithPending.add(ruleUID);
    }
  });

  // When filtering by pending, count all rules with pending instances (may also have firing)
  if (alertstateFilter === PromAlertingRuleState.Pending) {
    return {
      firing: 0,
      pending: rulesWithPending.size,
    };
  }

  // When filtering by firing, count all rules with firing instances (may also have pending)
  if (alertstateFilter === PromAlertingRuleState.Firing) {
    return {
      firing: rulesWithFiring.size,
      pending: 0,
    };
  }

  // When no filter: firing takes precedence
  // A rule is "firing" if it has ANY firing instances (even if it also has pending)
  // A rule is "pending" ONLY if it has pending instances but NO firing instances
  const onlyPending = new Set([...rulesWithPending].filter((uid) => !rulesWithFiring.has(uid)));

  return {
    firing: rulesWithFiring.size, // ALL rules with firing instances
    pending: onlyPending.size, // ONLY rules with no firing instances
  };
}

function countInstances(instanceDfv: DataFrameView<Frame>) {
  const getValue = (state: AlertState) => {
    const index = instanceDfv.fields.alertstate.values.findIndex((s) => s === state);
    return instanceDfv.fields.Value.values[index] ?? 0;
  };
  return { firing: getValue(PromAlertingRuleState.Firing), pending: getValue(PromAlertingRuleState.Pending) };
}

interface StatRowProps {
  i18nKey: string;
  color: 'error' | 'warning';
  values: Record<string, number>;
  children: React.ReactNode;
}

function StatRow({ i18nKey, color, values, children }: StatRowProps) {
  return (
    <Text color={color}>
      <Trans i18nKey={i18nKey} values={values}>
        {children}
      </Trans>
    </Text>
  );
}

function SummaryStatsContent() {
  const filter = useQueryFilter();
  const alertstateFilter = parseAlertstateFilter(filter);

  const instanceDataProvider = useQueryRunner({
    queries: [getDataQuery(`count by (alertstate) (${METRIC_NAME}{${filter}})`, { instant: true, format: 'table' })],
  });

  // Always remove alertstate filter from rule query to get accurate counts across both states
  // This ensures we can count rules that have instances in either state
  const ruleFilter = filter
    .replace(/alertstate\s*=~?\s*"(firing|pending)"[,\s]*/, '')
    .replace(/,\s*$/, '')
    .replace(/^\s*,/, '');
  const ruleDataProvider = useQueryRunner({
    queries: [
      getDataQuery(
        `count by (alertname, grafana_folder, grafana_rule_uid, alertstate) (${METRIC_NAME}{${ruleFilter}})`,
        {
          instant: true,
          format: 'table',
        }
      ),
    ],
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
    <Stack direction="column" alignItems="flex-end" gap={0}>
      <Spacer />
      {alertstateFilter === PromAlertingRuleState.Firing && (
        <>
          <StatRow i18nKey="alerting.triage.firing-rules-count" color="error" values={{ count: rules.firing }}>
            {'{{count}} firing alert rules'}
          </StatRow>
          <StatRow
            i18nKey="alerting.triage.firing-instances-count"
            color="error"
            values={{ firingCount: instances.firing }}
          >
            {'{{firingCount}} firing instances'}
          </StatRow>
        </>
      )}
      {alertstateFilter === PromAlertingRuleState.Pending && (
        <>
          <StatRow
            i18nKey="alerting.triage.rules-with-pending-instances"
            color="warning"
            values={{ count: rules.pending }}
          >
            {'{{count}} rules with pending instances'}
          </StatRow>
          <StatRow
            i18nKey="alerting.triage.pending-instances-count"
            color="warning"
            values={{ pendingCount: instances.pending }}
          >
            {'{{pendingCount}} pending instances'}
          </StatRow>
        </>
      )}
      {!alertstateFilter && (
        <>
          <StatRow i18nKey="alerting.triage.firing-rules-count" color="error" values={{ count: rules.firing }}>
            {'{{count}} firing alert rules'}
          </StatRow>
          <StatRow
            i18nKey="alerting.triage.firing-instances-count"
            color="error"
            values={{ firingCount: instances.firing }}
          >
            {'{{firingCount}} firing instances'}
          </StatRow>
          <StatRow i18nKey="alerting.triage.pending-rules-count" color="warning" values={{ count: rules.pending }}>
            {'{{count}} pending alert rules'}
          </StatRow>
          <StatRow
            i18nKey="alerting.triage.pending-instances-count"
            color="warning"
            values={{ pendingCount: instances.pending }}
          >
            {'{{pendingCount}} pending instances'}
          </StatRow>
        </>
      )}
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
