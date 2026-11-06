import { useState } from 'react';

import {
  type AlertRule,
  useDeleteAlertRuleMutation,
  useUpdateAlertRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfirmModal, Dropdown, LinkButton, Menu, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { AnalyzeRuleButton } from 'app/features/alerting/unified/components/assistant/AnalizeRuleButton';
import { DeclareIncidentMenuItem } from 'app/features/alerting/unified/components/bridges/DeclareIncidentButton';
import { EnrichmentDrawerExtension } from 'app/features/alerting/unified/components/rule-list/extensions/EnrichmentDrawerExtension';
import { RedirectToCloneRule } from 'app/features/alerting/unified/components/rules/CloneRule';
import SilenceGrafanaRuleDrawer from 'app/features/alerting/unified/components/silences/SilenceGrafanaRuleDrawer';
import { isGranted } from 'app/features/alerting/unified/hooks/abilities/abilityUtils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { isK8sEntityProvisioned } from 'app/features/alerting/unified/utils/k8s/utils';
import { isLocalDevEnv, isOpenSourceEdition } from 'app/features/alerting/unified/utils/misc';
import { type GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { grafanaRulesNav } from '../../utils/navigation';

import { useRuleAbilities } from './useRuleAbilities';

interface AlertRuleActionsProps {
  rule: AlertRule;
}

export function AlertRuleActions({ rule }: AlertRuleActionsProps) {
  const uid = rule.metadata.name ?? '';
  const title = rule.spec.title ?? '';
  const abilities = useRuleAbilities(rule);

  const [showSilenceDrawer, setShowSilenceDrawer] = useState(false);
  const [showEnrichmentDrawer, setShowEnrichmentDrawer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [redirectToClone, setRedirectToClone] = useState(false);

  const [deleteAlertRule] = useDeleteAlertRuleMutation();
  const [updateAlertRule, { isLoading: isPausing }] = useUpdateAlertRuleMutation();

  const { isAvailable: isAssistantAvailable } = useAssistant();

  const isPaused = rule.spec?.paused ?? false;
  const isProvisioned = isK8sEntityProvisioned(rule);

  const identifier: GrafanaRuleIdentifier = { ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid };

  const handlePauseResume = async () => {
    const result = await updateAlertRule({ name: uid, patch: { spec: { paused: !isPaused } } });
    if ('error' in result) {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.actions.pause-error', 'Failed to {{action}} rule', {
          action: isPaused
            ? t('alerting.gma-rule-list.actions.resume-action', 'resume')
            : t('alerting.gma-rule-list.actions.pause-action', 'pause'),
          interpolation: { escapeValue: false },
        }),
      ]);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    const result = await deleteAlertRule({ name: uid });
    if ('error' in result) {
      appEvents.emit(AppEvents.alertError, [t('alerting.gma-rule-list.actions.delete-error', 'Failed to delete rule')]);
    }
  };

  const handleCopyLink = async () => {
    const url = window.location.origin + grafanaRulesNav.viewLink(uid);
    try {
      await navigator.clipboard.writeText(url);
      appEvents.emit(AppEvents.alertSuccess, [t('alerting.gma-rule-list.actions.copy-link-success', 'Link copied')]);
    } catch {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.actions.copy-link-error', 'Failed to copy link'),
      ]);
    }
  };

  const canManageEnrichments = isGranted(abilities.canManageEnrichments);
  const shouldShowDeclareIncident = (!isOpenSourceEdition() || isLocalDevEnv()) && rule.status?.state === 'Firing';

  const menu = (
    <Menu>
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.view', 'View')}
        icon="eye"
        url={grafanaRulesNav.viewLink(uid)}
      />
      {isGranted(abilities.canDuplicate) && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.duplicate', 'Duplicate')}
          icon="copy"
          onClick={() => setRedirectToClone(true)}
        />
      )}
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.copy-link', 'Copy link')}
        icon="link"
        onClick={handleCopyLink}
      />
      {isGranted(abilities.canPause) && (
        <>
          <Menu.Divider />
          <Menu.Item
            label={
              isPaused
                ? t('alerting.gma-rule-list.actions.resume', 'Resume')
                : t('alerting.gma-rule-list.actions.pause', 'Pause')
            }
            icon={isPaused ? 'play' : 'pause'}
            onClick={handlePauseResume}
            disabled={isPausing}
          />
        </>
      )}
      {isGranted(abilities.canDelete) && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.delete', 'Delete')}
          icon="trash-alt"
          destructive
          onClick={() => setShowDeleteConfirm(true)}
        />
      )}
      {(isAssistantAvailable || canManageEnrichments) && <Menu.Divider />}
      {isAssistantAvailable && <AnalyzeRuleButton alertRule={rule} />}
      {canManageEnrichments && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.manage-enrichments', 'Manage enrichments')}
          icon="info-circle"
          onClick={() => setShowEnrichmentDrawer(!showEnrichmentDrawer)}
        />
      )}
      {isGranted(abilities.canSilence) && (
        <>
          <Menu.Divider />
          <Menu.Item
            label={t('alerting.gma-rule-list.actions.silence', 'Silence notifications')}
            icon="bell-slash"
            onClick={() => setShowSilenceDrawer(true)}
          />
        </>
      )}
      {shouldShowDeclareIncident && <DeclareIncidentMenuItem title={title} url={grafanaRulesNav.viewLink(uid)} />}
    </Menu>
  );

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {isGranted(abilities.canEdit) && (
        <LinkButton size="sm" variant="secondary" fill="text" href={grafanaRulesNav.editLink(uid)}>
          <Trans i18nKey="common.edit">Edit</Trans>
        </LinkButton>
      )}

      <Dropdown overlay={menu}>
        <MoreButton />
      </Dropdown>

      {showSilenceDrawer && <SilenceGrafanaRuleDrawer ruleUid={uid} onClose={() => setShowSilenceDrawer(false)} />}
      {showEnrichmentDrawer && (
        <EnrichmentDrawerExtension ruleUid={uid} onClose={() => setShowEnrichmentDrawer(false)} />
      )}
      {showDeleteConfirm && (
        <ConfirmModal
          isOpen
          title={t('alerting.gma-rule-list.actions.delete-confirm-title', 'Delete alert rule')}
          body={t('alerting.gma-rule-list.actions.delete-confirm-body', 'Delete "{{title}}"?', {
            title,
            interpolation: { escapeValue: false },
          })}
          confirmText={t('alerting.gma-rule-list.actions.delete-confirm-button', 'Delete')}
          onConfirm={handleDelete}
          onDismiss={() => setShowDeleteConfirm(false)}
        />
      )}
      {redirectToClone && (
        <RedirectToCloneRule
          identifier={identifier}
          isProvisioned={isProvisioned}
          onDismiss={() => setRedirectToClone(false)}
        />
      )}
    </Stack>
  );
}
