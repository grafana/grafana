import { type ReactNode, useMemo } from 'react';

import { AlertLabels, StateText } from '@grafana/alerting/unstable';
import { type Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, LinkButton, Stack, Text, Tooltip } from '@grafana/ui';
import { AccessControlAction } from 'app/types/accessControl';
import { GrafanaAlertState, type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { createBridgeURL } from '../../components/PluginBridge';
import { useCanCreateSilences } from '../../hooks/useAbilities';
import { stringifyFolder, useFolder } from '../../hooks/useFolder';
import { canAccessPluginPage, useIrmPlugin } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { MATCHER_ALERT_RULE_UID } from '../../utils/constants';
import { isLocalDevEnv, isOpenSourceEdition, makeLabelBasedSilenceLink } from '../../utils/misc';

import { InstanceLocation } from './InstanceDetailsDrawer';

type StateTextState = 'normal' | 'firing' | 'pending' | 'recovering' | 'unknown';
type StateTextHealth = 'ok' | 'nodata' | 'error';

function grafanaAlertStateToStateTextProps(state: GrafanaAlertState): {
  state?: StateTextState;
  health?: StateTextHealth;
} {
  switch (state) {
    case GrafanaAlertState.Alerting:
      return { state: 'firing' };
    case GrafanaAlertState.Pending:
      return { state: 'pending' };
    case GrafanaAlertState.Normal:
      return { state: 'normal' };
    case GrafanaAlertState.Recovering:
      return { state: 'recovering' };
    case GrafanaAlertState.NoData:
      return { health: 'nodata' };
    case GrafanaAlertState.Error:
      return { health: 'error' };
    default:
      return { state: 'unknown' };
  }
}

interface InstanceDetailsDrawerTitleProps {
  instanceLabels: Labels;
  commonLabels?: Labels;
  alertState?: GrafanaAlertState | null;
  rule?: GrafanaRuleDefinition;
  onOpenSilence?: () => void;
  titleText?: string;
  /** Overrides the muted label above the title (defaults to Alert Instance). */
  sectionLabel?: ReactNode;
  hideActions?: boolean;
  titleSection?: ReactNode;
  showAlertState?: boolean;
}

export function InstanceDetailsDrawerTitle({
  instanceLabels,
  commonLabels,
  alertState,
  rule,
  onOpenSilence,
  titleText,
  sectionLabel,
  hideActions = false,
  titleSection,
  showAlertState = true,
}: InstanceDetailsDrawerTitleProps) {
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
      {titleSection && <Stack direction="row">{titleSection}</Stack>}
      {!titleSection && folder && rule && (
        <InstanceLocation
          folderTitle={stringifyFolder(folder)}
          groupName={rule.rule_group}
          ruleName={rule.title}
          namespaceUid={rule.namespace_uid}
          ruleUid={rule.uid}
        />
      )}
      <Stack direction="column" gap={0.5}>
        <Text variant="bodySmall" color="secondary">
          {sectionLabel ?? (
            <Trans i18nKey="alerting.triage.instance-details-drawer.alert-instance-label">Alert Instance</Trans>
          )}
        </Text>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
            <Text variant="h3" element="h3" truncate>
              {titleText ?? rule?.title ?? (
                <Trans i18nKey="alerting.triage.instance-details-drawer.instance-details">Instance details</Trans>
              )}
            </Text>
            {showAlertState && alertState && (
              <StateText type="alerting" {...grafanaAlertStateToStateTextProps(alertState)} />
            )}
          </Stack>
          {!hideActions && (
            <Stack direction="row" gap={1} alignItems="center">
              {silenceLink && (
                <>
                  {canSilence && onOpenSilence && (
                    <Button icon="bell-slash" variant="secondary" size="sm" onClick={onOpenSilence}>
                      <Trans i18nKey="alerting.triage.instance-details-drawer.silence-button">Silence</Trans>
                    </Button>
                  )}
                  {canSilence && !onOpenSilence && (
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
                  {!canSilence && (
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
                </>
              )}
              {shouldShowDeclareIncident && (
                <>
                  {canAccessIncident ? (
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
                  ) : (
                    <Tooltip
                      content={t(
                        'alerting.triage.instance-details-drawer.declare-incident-no-permission',
                        'You do not have permission to access Incident'
                      )}
                    >
                      <Button icon="fire" variant="secondary" size="sm" disabled>
                        <Trans i18nKey="alerting.triage.instance-details-drawer.declare-incident">
                          Declare incident
                        </Trans>
                      </Button>
                    </Tooltip>
                  )}
                </>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
      <Box>
        {Object.keys(instanceLabels).length > 0 ? (
          <AlertLabels
            labels={instanceLabels}
            displayCommonLabels={commonLabels !== undefined}
            labelSets={commonLabels !== undefined ? [instanceLabels, commonLabels] : undefined}
            commonLabelsMode="tooltip"
          />
        ) : (
          <Text color="secondary">{t('alerting.triage.no-labels', 'No labels')}</Text>
        )}
      </Box>
    </Stack>
  );
}
