import { Trans } from '@grafana/i18n';
import { Button, Stack, Text, TextLink } from '@grafana/ui';
import { type AlertmanagerAlert, type Silence, SilenceState } from 'app/plugins/datasource/alertmanager/types';

import { alertSilencesApi } from '../../api/alertSilencesApi';
import { isSupported } from '../../hooks/abilities/abilityUtils';
import { useSilenceAbility } from '../../hooks/abilities/alertmanager/useSilenceAbility';
import { SilenceAction } from '../../hooks/abilities/types';
import { createReturnTo } from '../../hooks/useReturnTo';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { MATCHER_ALERT_RULE_UID } from '../../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid } from '../../utils/datasource';

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

  const { selectedAlertmanager: alertManagerSourceName = '' } = useAlertmanager();
  const updateAbility = useSilenceAbility({ action: SilenceAction.Update });
  const [expireSilence, { isLoading: isExpiring }] = alertSilencesApi.endpoints.expireSilence.useMutation();

  const isGrafanaFlavoredAlertmanager = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;
  const isExpired = silence.status.state === SilenceState.Expired;
  const canExpire =
    isSupported(updateAbility) &&
    !isExpired &&
    (isGrafanaFlavoredAlertmanager ? silence.accessControl?.write : updateAbility.granted);

  const alertRuleHref = ruleUid
    ? `/alerting/grafana/${encodeURIComponent(ruleUid)}/view?${new URLSearchParams({ returnTo }).toString()}`
    : '';

  return (
    <Stack direction="column" gap={2}>
      {canExpire && (
        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="secondary"
            icon="bell"
            disabled={isExpiring}
            onClick={() =>
              expireSilence({ datasourceUid: getDatasourceAPIUid(alertManagerSourceName), silenceId: silence.id })
            }
          >
            <Trans i18nKey="silences.table.unsilence-button">Unsilence</Trans>
          </Button>
        </Stack>
      )}

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
