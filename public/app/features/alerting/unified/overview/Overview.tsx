import { css } from '@emotion/css';
import { formatDistanceToNow, min, parseISO } from 'date-fns';
import pluralize from 'pluralize';
import { memo, useState } from 'react';

import { GrafanaTheme2, SelectableValue, findCommonLabels, matchAllLabels } from '@grafana/data';
import {
  Button,
  Drawer,
  Icon,
  IconButton,
  RadioButtonGroup,
  Stack,
  Text,
  TextLink,
  useStyles2,
  withErrorBoundary,
} from '@grafana/ui';
import { AlertState, AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { Alert, AlertingRule } from 'app/types/unified-alerting';
import {
  GrafanaAlertState,
  GrafanaPromAlertingRuleDTO,
  Labels,
  PromAlertingRuleState,
  mapStateWithReasonToBaseState,
} from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { prometheusApi } from '../api/prometheusApi';
import { AlertLabels } from '../components/AlertLabels';
import { AlertStateDot } from '../components/AlertStateDot';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { StateBadge } from '../components/rule-viewer/StateBadges';
import { isPrivateLabelKey } from '../utils/labels';
import { prometheusRuleType } from '../utils/rules';

const { useGetGrafanaGroupsQuery } = prometheusApi;
const { useGetAlertmanagerAlertsQuery } = alertmanagerApi;

const alertStateOptions: Array<SelectableValue<GrafanaAlertState>> = Object.values(GrafanaAlertState).map((state) => ({
  label: state,
  value: state,
}));

interface PromRuleWithOrigin extends GrafanaPromAlertingRuleDTO {
  namespace: string;
  group: string;
}

function Overview() {
  const { data: promRespose } = useGetGrafanaGroupsQuery({});

  const { data: amAlerts = [] } = useGetAlertmanagerAlertsQuery({
    amSourceName: 'grafana',
  });

  const [details, setDetails] = useState<{ rule: AlertingRule; amAlerts: AlertmanagerAlert[] } | null>(null);

  const promGroups = promRespose?.data?.groups ?? [];
  const promRules: PromRuleWithOrigin[] = promGroups
    .flatMap((group) => group.rules.filter(prometheusRuleType.grafana.alertingRule).map((r) => [group, r] as const))
    .map(([group, r]) => ({ ...r, namespace: group.file, group: group.name }));

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
      <Stack direction="column" gap={2}>
        <RadioButtonGroup options={alertStateOptions} />
        <div className={styles.rulesGrid}>
          {combinedRules.map(({ rule, amAlerts }) => (
            <RuleRow key={rule.uid} rule={rule} amAlerts={amAlerts} onDetailsClick={setDetails} />
          ))}
        </div>
      </Stack>
      {details && <InstancesDrawer rule={details.rule} instances={details.amAlerts} onClose={() => setDetails(null)} />}
    </AlertingPageWrapper>
  );
}

interface RuleRowProps {
  rule: PromRuleWithOrigin;
  amAlerts: AlertmanagerAlert[];
  onDetailsClick: ({ rule, amAlerts }: { rule: PromRuleWithOrigin; amAlerts: AlertmanagerAlert[] }) => void;
}

const RuleRow = memo(function RuleRow({ rule, amAlerts, onDetailsClick }: RuleRowProps) {
  const styles = useStyles2(getStyles);

  const startDates = amAlerts.map((alert) => parseISO(alert.startsAt));

  const commonLabels = findCommonLabels(amAlerts.map((alert) => alert.labels));

  const { namespace, group } = rule;

  return (
    <>
      <div className={styles.stateCell}>
        <AlertStateDot color={rulerAlertStateToColor(rule.state)} />
      </div>
      <div>
        <Text element="h2" variant="body" weight="bold">
          {rule.name}
        </Text>
        <Stack direction="row" gap={0.5}>
          <Text color="secondary" variant="bodySmall">
            <RuleLocation namespace={namespace} group={group} />
          </Text>
          <TextLink
            href={`/alerting/unified/rules/${rule.uid}?tab=instances`}
            variant="bodySmall"
            color="primary"
            inline={false}
          >
            {pluralize('instance', rule.alerts?.length ?? 0, true)}
          </TextLink>
        </Stack>
      </div>
      <div className={styles.labelsCell}>
        <AlertLabels labels={commonLabels} size="xs" />
      </div>
      {/* <div>{pluralize('instance', amAlerts.length, true)}</div> */}
      {/* <div>{earliestDate ? `${formatDistanceToNow(earliestDate)} ago` : '-'}</div> */}
      {/* <div>
        {amAlerts.flatMap((alert) => alert.receivers).length} <Icon name="envelope" title="Notifications sent" />
      </div> */}
      <div className={styles.detailsButton}>
        <Button
          variant="secondary"
          size="sm"
          title="Details"
          aria-label="Details"
          onClick={() => onDetailsClick({ rule, amAlerts })}
        >
          Details
        </Button>
      </div>
      <div className={styles.separator} />
    </>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  rulesGrid: css({
    display: 'grid',
    gridTemplateColumns: 'max-content auto 1fr 1fr 1fr',
    gap: theme.spacing(1),
  }),
  stateCell: css({
    // gridRow: 'span 2',
    alignContent: 'center',
    padding: theme.spacing(0, 1),
  }),
  labelsCell: css({
    // gridColumn: '3 / -3',
  }),
  namespace: css({
    width: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  separator: css({
    // gridColumn: '1 / -1',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  detailsButton: css({
    // gridColumn: '6 / -1',
    // gridRow: 'span 2',
  }),
});

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
  const combinedInstances = combineInstances(rule.alerts ?? [], instances);
  const commonLabels = findCommonLabels(combinedInstances.map((instance) => instance.labels));

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

export const RuleLocation = ({ namespace, group }: { namespace: string; group: string }) => {
  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Icon size="xs" name="folder" />
      <Stack direction="row" alignItems="center" gap={0}>
        {namespace}
        <Icon size="sm" name="angle-right" />
        {group}
      </Stack>
    </Stack>
  );
};

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
