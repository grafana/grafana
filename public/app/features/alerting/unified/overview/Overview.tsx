import { css } from '@emotion/css';
import { format, formatDistanceToNow, min, parseISO } from 'date-fns';
import pluralize from 'pluralize';
import React, { useState } from 'react';

import { findCommonLabels, GrafanaTheme2, matchAllLabels, SelectableValue } from '@grafana/data';
import {
  Stack,
  useStyles2,
  withErrorBoundary,
  Text,
  Drawer,
  Icon,
  IconButton,
  ButtonGroup,
  RadioButtonGroup,
} from '@grafana/ui';
import { AlertmanagerAlert, AlertState } from 'app/plugins/datasource/alertmanager/types';
import { Alert, AlertingRule } from 'app/types/unified-alerting';
import {
  GrafanaAlertState,
  Labels,
  mapStateWithReasonToBaseState,
  PromAlertingRuleState,
} from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { AlertLabels } from '../components/AlertLabels';
import { AlertStateDot } from '../components/AlertStateDot';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { StateBadge } from '../components/rule-viewer/StateBadges';
import { isPrivateLabelKey } from '../utils/labels';
import { isAlertingRule } from '../utils/rules';

const { usePrometheusRuleNamespacesQuery } = alertRuleApi;
const { useGetAlertmanagerAlertsQuery } = alertmanagerApi;

const alertStateOptions: Array<SelectableValue<GrafanaAlertState>> = Object.values(GrafanaAlertState).map((state) => ({
  label: state,
  value: state,
}));

function Overview() {
  const { data: namespaces = [] } = usePrometheusRuleNamespacesQuery({
    ruleSourceName: 'grafana',
  });
  const { data: amAlerts = [] } = useGetAlertmanagerAlertsQuery({
    amSourceName: 'grafana',
  });

  const [details, setDetails] = useState<{ rule: AlertingRule; amAlerts: AlertmanagerAlert[] } | null>(null);

  const promRules = namespaces
    .flatMap((ns) => ns.groups)
    .flatMap((g) => g.rules)
    .filter(isAlertingRule);

  const alertsByRule = new Map<string, AlertmanagerAlert[]>();

  amAlerts.forEach((alert) => {
    const ruleUID = alert.labels.__alert_rule_uid__;
    if (!ruleUID) {
      return;
    }

    const currentAlerts = alertsByRule.get(ruleUID);
    if (currentAlerts) {
      currentAlerts.push(alert);
    } else {
      alertsByRule.set(ruleUID, [alert]);
    }
  });

  const combinedRules = promRules.map((promRule) => {
    return {
      rule: promRule,
      amAlerts: alertsByRule.get(promRule.uid) ?? [],
    };
  });

  const styles = useStyles2(getStyles);
  return (
    <AlertingPageWrapper navId="alerting" pageNav={{ text: 'Alerting overview' }}>
      <RadioButtonGroup options={alertStateOptions} />
      <div className={styles.rulesGrid}>
        {combinedRules.map(({ rule, amAlerts }) => {
          const commonLabels = findCommonLabels(amAlerts.map((alert) => alert.labels));
          const startDates = amAlerts.map((alert) => parseISO(alert.startsAt));
          const earliestDate = startDates.length > 0 ? min(startDates) : null;

          return (
            <React.Fragment key={rule.uid}>
              <div className={styles.stateCell}>
                <StateBadge state={rule.state} />
              </div>
              <div>
                <Text element="h2" variant="body" weight="bold">
                  {rule.name}
                </Text>
              </div>
              <div>{pluralize('instance', amAlerts.length, true)}</div>
              <div>{earliestDate ? `${formatDistanceToNow(earliestDate)} ago` : '-'}</div>
              <div>
                {amAlerts.flatMap((alert) => alert.receivers).length}{' '}
                <Icon name="envelope" title="Notifications sent" />
              </div>
              <div>
                <IconButton
                  name="eye"
                  title="Details"
                  aria-label="Details"
                  onClick={() => setDetails({ rule, amAlerts })}
                />
              </div>
              <div className={styles.labelsCell}>
                <AlertLabels labels={commonLabels} size="sm" />
              </div>
              <div className={styles.separator} />
            </React.Fragment>
          );
        })}
      </div>
      {details && <InstancesDrawer rule={details.rule} instances={details.amAlerts} onClose={() => setDetails(null)} />}
    </AlertingPageWrapper>
  );
}

interface InstancesDrawerProps {
  rule: AlertingRule;
  instances: AlertmanagerAlert[];
  onClose: () => void;
}

function amStateToColor(state: AlertState): 'error' | 'warning' | 'success' | 'info' {
  switch (state) {
    case AlertState.Active:
      return 'error';
    case AlertState.Suppressed:
      return 'info';
    case AlertState.Unprocessed:
      return 'warning';
    default:
      return 'info';
  }
}

function rulerAlertStateToColor(
  state: GrafanaAlertState | PromAlertingRuleState
): 'error' | 'warning' | 'success' | 'info' {
  switch (state) {
    case GrafanaAlertState.Error:
    case GrafanaAlertState.Alerting:
    case PromAlertingRuleState.Firing:
      return 'error';
    case GrafanaAlertState.Normal:
      return 'success';
    case GrafanaAlertState.Pending:
      return 'warning';
    case GrafanaAlertState.NoData:
      return 'info';
    default:
      return 'info';
  }
}

function InstancesDrawer({ rule, instances, onClose }: InstancesDrawerProps) {
  const styles = useStyles2(getInstancesDrawerStyles);

  const commonAmLabels = findCommonLabels(instances.map((instance) => instance.labels));
  const commonRuleLabels = findCommonLabels(rule.alerts?.map((alert) => alert.labels) ?? []);

  const combinedInstances = combineInstances(rule.alerts ?? [], instances);
  const commonLabels = findCommonLabels(combinedInstances.map((instance) => instance.labels));

  // TODO Display non-matching alerts

  return (
    <Drawer
      title={rule.name}
      size="lg"
      onClose={onClose}
      closeOnMaskClick
      subtitle={<AlertLabels labels={commonLabels} size="sm" />}
    >
      <Stack direction="column" gap={2}>
        {combinedInstances.map(({ rulerAlert, amAlert, labels }, index) => {
          return (
            <>
              <Stack direction="column" gap={0.5} key={JSON.stringify(labels)}>
                <AlertLabels labels={labels} commonLabels={commonLabels} size="sm" />
                <Stack direction="row" gap={1}>
                  <EvaluationSection rulerAlert={rulerAlert} />
                  <DeliverySection amAlert={amAlert} />
                </Stack>
              </Stack>
              {index < combinedInstances.length - 1 && <Spacer />}
            </>
          );
        })}
      </Stack>
    </Drawer>
  );
}

function EvaluationSection({ rulerAlert }: { rulerAlert?: Alert }) {
  return (
    <Stack direction="column" gap={0.5} flex={1}>
      <Stack direction="row" gap={1} alignItems="center">
        <Text element="h3" variant="body" weight="bold">
          Evaluation
        </Text>
        <EvaluationStatusBadge rulerAlert={rulerAlert} />
      </Stack>
      {rulerAlert && <Text>Fired: {formatDistanceToNow(parseISO(rulerAlert.activeAt))} ago</Text>}
    </Stack>
  );
}

function EvaluationStatusBadge({ rulerAlert }: { rulerAlert?: Alert }) {
  const color = rulerAlert ? rulerAlertStateToColor(mapStateWithReasonToBaseState(rulerAlert.state)) : 'none';
  return (
    <Stack direction="row" gap={0.5} wrap={'nowrap'} flex={'0 0 auto'}>
      <AlertStateDot color={color} />
      <Text variant="bodySmall" color={color === 'none' ? undefined : color}>
        {rulerAlert?.state ? mapStateWithReasonToBaseState(rulerAlert.state) : 'No evaluation'}
      </Text>
    </Stack>
  );
}

function DeliverySection({ amAlert }: { amAlert?: AlertmanagerAlert }) {
  const styles = useStyles2(getInstancesDrawerStyles);
  return (
    <Stack direction="column" gap={0.5} flex={1}>
      <Stack direction="row" gap={1} flex={1} alignItems="center">
        <Text element="h3" variant="body" weight="bold">
          Delivery
        </Text>
        <DeliveryStatusBadge amAlert={amAlert} />
      </Stack>
      <Stack direction="column" gap={0.5} flex={1}>
        {amAlert && (
          <>
            <Text>Last update: {formatDistanceToNow(parseISO(amAlert.updatedAt))} ago</Text>
            <Stack direction="row" gap={0.5} wrap="wrap">
              {amAlert.receivers.map((receiver) => (
                <div className={styles.contactPointPill} key={receiver.name}>
                  <Icon name="envelope" /> {receiver.name}
                </div>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Stack>
  );
}

function DeliveryStatusBadge({ amAlert }: { amAlert?: AlertmanagerAlert }) {
  const color = amAlert ? amStateToColor(amAlert.status.state) : 'none';

  return (
    <Stack direction="row" gap={0.5} wrap={'nowrap'} flex={'0 0 auto'}>
      <AlertStateDot color={color} />
      <Text variant="bodySmall" color={color === 'none' ? undefined : color}>
        {amAlert?.status.state ?? 'No deliveries'}
      </Text>
    </Stack>
  );
}

function Spacer() {
  const styles = useStyles2(getInstancesDrawerStyles);
  return <div className={styles.spacer} />;
}

interface CombinedInstance {
  rulerAlert?: Alert;
  amAlert?: AlertmanagerAlert;
  labels: Labels;
}

function combineInstances(rulerInstances: Alert[], amInstances: AlertmanagerAlert[]): CombinedInstance[] {
  const result: CombinedInstance[] = [];
  const amInstancesSet = new Set(amInstances);

  rulerInstances.forEach((rulerAlert) => {
    const matchingAmAlert = findMatchingAmAlert(rulerAlert, amInstances);
    result.push({
      rulerAlert,
      amAlert: matchingAmAlert,
      labels: rulerAlert.labels, // Labels should be the same for both
    });

    if (matchingAmAlert) {
      amInstancesSet.delete(matchingAmAlert);
    }
  });

  amInstancesSet.forEach((amAlert) => {
    result.push({
      amAlert,
      rulerAlert: undefined,
      labels: amAlert.labels,
    });
  });

  return result;
}

function findMatchingAmAlert(rulerAlert: Alert, amAlerts: AlertmanagerAlert[]): AlertmanagerAlert | undefined {
  return amAlerts.find((amAlert) => {
    const rulerAlertLabels = Object.fromEntries(
      Object.entries(rulerAlert.labels).filter(([key]) => !isPrivateLabelKey(key))
    );
    const amAlertLabels = Object.fromEntries(Object.entries(amAlert.labels).filter(([key]) => !isPrivateLabelKey(key)));

    const hasSameSize = Object.keys(rulerAlertLabels).length === Object.keys(amAlertLabels).length;
    if (!hasSameSize) {
      return false;
    }
    return matchAllLabels(rulerAlertLabels, amAlertLabels);
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  rulesGrid: css({
    display: 'grid',
    gridTemplateColumns: 'max-content auto 1fr 1fr 2fr 1fr',
    gap: theme.spacing(1),
  }),
  stateCell: css({
    gridRow: 'span 2',
    alignContent: 'center',
  }),
  labelsCell: css({
    gridColumn: '2 / -1',
  }),
  separator: css({
    gridColumn: '1 / -1',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
});

const getInstancesDrawerStyles = (theme: GrafanaTheme2) => ({
  combinedStatusGrid: css({
    display: 'grid',
    gridTemplateColumns: 'max-content max-content 2fr',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
  contactPointPill: css({
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.pill,
    backgroundColor: theme.colors.background.secondary,
  }),
  spacer: css({
    flex: 1,
    flexBasis: 1,
    backgroundColor: theme.colors.border.weak,
  }),
});

export default withErrorBoundary(Overview, { style: 'page' });
