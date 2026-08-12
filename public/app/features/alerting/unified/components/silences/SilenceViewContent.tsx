import { Trans } from '@grafana/i18n';
import { Stack, Text, TextLink } from '@grafana/ui';
import { type AlertmanagerAlert, type Silence } from 'app/plugins/datasource/alertmanager/types';

import { createReturnTo } from '../../hooks/useReturnTo';
import { MATCHER_ALERT_RULE_UID } from '../../utils/constants';

import { Matchers } from './Matchers';
import { MissingAlertRuleWarning } from './MissingAlertRuleWarning';
import { SilenceMetadataGrid } from './SilenceMetadataGrid';
import SilencedAlertsTable from './SilencedAlertsTable';

interface SilenceViewContentProps {
  silence: Silence;
  silencedAlerts: AlertmanagerAlert[];
}

export function SilenceViewContent({ silence, silencedAlerts }: SilenceViewContentProps) {
  const { matchers = [], comment, createdBy, startsAt, endsAt, metadata } = silence;
  const filteredMatchers = matchers.filter((m) => m.name !== MATCHER_ALERT_RULE_UID);
  const returnTo = createReturnTo();
  const ruleUid = metadata?.rule_uid;

  const alertRuleHref = ruleUid
    ? `/alerting/grafana/${encodeURIComponent(ruleUid)}/view?${new URLSearchParams({ returnTo }).toString()}`
    : '';

  return (
    <Stack direction="column" gap={2}>
      {ruleUid && (
        <Stack direction="column" gap={0.5}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.silence-view.alert-rule">Alert rule</Trans>
          </Text>
          {metadata?.rule_title ? (
            <TextLink href={alertRuleHref}>{metadata.rule_title}</TextLink>
          ) : (
            <MissingAlertRuleWarning ruleUid={ruleUid} />
          )}
        </Stack>
      )}

      {filteredMatchers.length > 0 && (
        <Stack direction="column" gap={0.5}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.silence-view.matchers">Matching labels</Trans>
          </Text>
          <Matchers matchers={filteredMatchers} />
        </Stack>
      )}

      <SilenceMetadataGrid startsAt={startsAt} endsAt={endsAt} comment={comment} createdBy={createdBy} />

      {silencedAlerts.length > 0 && (
        <Stack direction="column" gap={0.5}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.silence-view.affected-alerts">Affected alerts</Trans>
          </Text>
          <SilencedAlertsTable silencedAlerts={silencedAlerts} />
        </Stack>
      )}
    </Stack>
  );
}
