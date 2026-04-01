import { useMemo } from 'react';

import { AlertLabels } from '@grafana/alerting/unstable';
import { type Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, LinkButton, Stack, Text, Tooltip } from '@grafana/ui';
import { AccessControlAction } from 'app/types/accessControl';
import { type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { createBridgeURL } from '../../components/PluginBridge';
import { useCanCreateSilences } from '../../hooks/useAbilities';
import { stringifyFolder, useFolder } from '../../hooks/useFolder';
import { canAccessPluginPage, useIrmPlugin } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { MATCHER_ALERT_RULE_UID } from '../../utils/constants';
import { isLocalDevEnv, isOpenSourceEdition, makeLabelBasedSilenceLink } from '../../utils/misc';

import { InstanceLocation } from './InstanceDetailsDrawer';

interface InstanceDetailsDrawerTitleProps {
  instanceLabels: Labels;
  rule?: GrafanaRuleDefinition;
}

export function InstanceDetailsDrawerTitle({ instanceLabels, rule }: InstanceDetailsDrawerTitleProps) {
  const { folder } = useFolder(rule?.namespace_uid);
  const { pluginId, installed, settings } = useIrmPlugin(SupportedPlugin.Incident);
  const canCreateSilence = useCanCreateSilences();

  const silenceLink = useMemo(() => {
    if (!rule) {
      return undefined;
    }
    const baseLink = makeLabelBasedSilenceLink('grafana', instanceLabels);
    const separator = baseLink.includes('?') ? '&' : '?';
    return `${baseLink}${separator}matcher=${encodeURIComponent(`${MATCHER_ALERT_RULE_UID}=${rule.uid}`)}`;
  }, [instanceLabels, rule]);

  const shouldShowDeclareIncident = (!isOpenSourceEdition() || isLocalDevEnv()) && installed && settings;
  const incidentURL = createBridgeURL(pluginId, '/incidents/declare', { title: rule?.title ?? '' });
  const canAccessIncident = settings
    ? canAccessPluginPage(settings, createBridgeURL(pluginId, '/incidents/declare'))
    : false;
  const hasFolderSilencePermission = folder?.accessControl?.[AccessControlAction.AlertingSilenceCreate] ?? false;
  const canSilence = canCreateSilence || hasFolderSilencePermission;

  return (
    <Stack direction="column" gap={2}>
      <Text variant="h3" element="h3" truncate>
        <Trans i18nKey="alerting.triage.instance-details-drawer.instance-details">Instance details</Trans>
      </Text>
      <Stack direction="row" gap={1}>
        {silenceLink && canSilence && (
          <LinkButton
            href={silenceLink}
            icon="bell-slash"
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Trans i18nKey="alerting.triage.instance-details-drawer.silence-button">Silence</Trans>
          </LinkButton>
        )}
        {silenceLink && !canSilence && (
          <Tooltip
            content={t(
              'alerting.triage.instance-details-drawer.silence-no-permission',
              'You do not have permission to create silences'
            )}
          >
            <Button icon="bell-slash" variant="secondary" size="sm" disabled>
              <Trans i18nKey="alerting.triage.instance-details-drawer.silence-button">Silence</Trans>
            </Button>
          </Tooltip>
        )}
        {shouldShowDeclareIncident && canAccessIncident && (
          <LinkButton
            href={incidentURL}
            icon="fire"
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Trans i18nKey="alerting.triage.instance-details-drawer.declare-incident">Declare incident</Trans>
          </LinkButton>
        )}
        {shouldShowDeclareIncident && !canAccessIncident && (
          <Tooltip
            content={t(
              'alerting.triage.instance-details-drawer.declare-incident-no-permission',
              'You do not have permission to access Incident'
            )}
          >
            <Button icon="fire" variant="secondary" size="sm" disabled>
              <Trans i18nKey="alerting.triage.instance-details-drawer.declare-incident">Declare incident</Trans>
            </Button>
          </Tooltip>
        )}
      </Stack>
      <Box>
        {Object.keys(instanceLabels).length > 0 ? (
          <AlertLabels labels={instanceLabels} />
        ) : (
          <Text color="secondary">{t('alerting.triage.no-labels', 'No labels')}</Text>
        )}
      </Box>
      {folder && rule && (
        <InstanceLocation
          folderTitle={stringifyFolder(folder)}
          groupName={rule.rule_group}
          ruleName={rule.title}
          namespaceUid={rule.namespace_uid}
          ruleUid={rule.uid}
        />
      )}
    </Stack>
  );
}
