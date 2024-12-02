import { css } from '@emotion/css';
import { format, formatDistanceToNow, min, parseISO } from 'date-fns';
import pluralize from 'pluralize';
import React, { useState } from 'react';

import { findCommonLabels, GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2, withErrorBoundary, Text, Drawer, Icon, IconButton, Tag } from '@grafana/ui';
import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AlertingRule } from 'app/types/unified-alerting';

import { alertRuleApi } from '../api/alertRuleApi';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { AlertLabels } from '../components/AlertLabels';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { AlertStateTag } from '../components/rules/AlertStateTag';
import { AmAlertStateTag } from '../components/silences/AmAlertStateTag';
import { isAlertingRule } from '../utils/rules';

const { usePrometheusRuleNamespacesQuery } = alertRuleApi;
const { useGetAlertmanagerAlertGroupsQuery } = alertmanagerApi;

function Overview() {
  const { data: namespaces = [] } = usePrometheusRuleNamespacesQuery({
    ruleSourceName: 'grafana',
  });
  const { data: alertGroups = [] } = useGetAlertmanagerAlertGroupsQuery({
    amSourceName: 'grafana',
  });

  const [details, setDetails] = useState<{ rule: AlertingRule; amAlerts: AlertmanagerAlert[] } | null>(null);

  const promRules = namespaces
    .flatMap((ns) => ns.groups)
    .flatMap((g) => g.rules)
    .filter(isAlertingRule);

  const amAlerts = alertGroups.flatMap((ag) => ag.alerts);
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
      <div className={styles.rulesGrid}>
        {combinedRules.map(({ rule, amAlerts }) => {
          const commonLabels = findCommonLabels(amAlerts.map((alert) => alert.labels));
          const startDates = amAlerts.map((alert) => parseISO(alert.startsAt));
          const earliestDate = startDates.length > 0 ? min(startDates) : null;

          return (
            <React.Fragment key={rule.uid}>
              <div className={styles.stateCell}>
                <AlertStateTag state={rule.state} />
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

function InstancesDrawer({ rule, instances, onClose }: InstancesDrawerProps) {
  const commonLabels = findCommonLabels(instances.map((instance) => instance.labels));
  return (
    <Drawer title={`Instances for ${rule.name}`} size="lg" onClose={onClose} closeOnMaskClick>
      <Stack direction="column" gap={1}>
        {instances.map((instance) => (
          <div key={instance.fingerprint}>
            <Stack direction="row" gap={1}>
              <AmAlertStateTag state={instance.status.state} />
              <Text>{format(parseISO(instance.startsAt), 'MMM d yyyy HH:mm:ss')}</Text>
              <AlertLabels labels={instance.labels} commonLabels={commonLabels} size="sm" />
              <Stack direction="row" gap={1}>
                {instance.receivers.map((receiver) => (
                  <Tag key={receiver.name} name={receiver.name} />
                ))}
              </Stack>
            </Stack>
          </div>
        ))}
      </Stack>
    </Drawer>
  );
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
    borderBottom: `1px solid ${theme.colors.border.medium}`,
  }),
});

export default withErrorBoundary(Overview, { style: 'page' });
