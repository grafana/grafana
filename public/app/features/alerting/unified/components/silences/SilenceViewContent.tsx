import { Trans } from '@grafana/i18n';
import { Stack, Text, TextLink } from '@grafana/ui';
import { AlertmanagerAlert, Silence } from 'app/plugins/datasource/alertmanager/types';

import { createReturnTo } from '../../hooks/useReturnTo';
import { MATCHER_ALERT_RULE_UID } from '../../utils/constants';

import { Matchers } from './Matchers';
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

  const alertRuleHref = metadata?.rule_uid
    ? `/alerting/grafana/${encodeURIComponent(metadata.rule_uid)}/view?${new URLSearchParams({ returnTo }).toString()}`
    : '';

  return (
    <Stack direction="column" gap={2}>
      {metadata?.rule_title && metadata?.rule_uid && (
        <Stack direction="column" gap={0.5}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.silence-view.alert-rule">Alert rule</Trans>
          </Text>
          <TextLink href={alertRuleHref}>{metadata.rule_title}</TextLink>
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
