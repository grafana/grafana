import { useState } from 'react';

import {
  type AlertRule,
  useDeleteAlertRuleMutation,
  useUpdateAlertRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useFlagAlertEnrichment, useFlagAlertingEnrichmentPerRule } from '@grafana/runtime/internal';
import { ConfirmModal, Dropdown, LinkButton, Menu, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { AnalyzeRuleButton } from 'app/features/alerting/unified/components/assistant/AnalizeRuleButton';
import { EnrichmentDrawerExtension } from 'app/features/alerting/unified/components/rule-list/extensions/EnrichmentDrawerExtension';
import { RedirectToCloneRule } from 'app/features/alerting/unified/components/rules/CloneRule';
import SilenceGrafanaRuleDrawer from 'app/features/alerting/unified/components/silences/SilenceGrafanaRuleDrawer';
import { isGranted } from 'app/features/alerting/unified/hooks/abilities/abilityUtils';
import { useEnrichmentAbility } from 'app/features/alerting/unified/hooks/abilities/otherAbilities';
import { EnrichmentAction } from 'app/features/alerting/unified/hooks/abilities/types';
import { AlertingAction, useAlertingAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { type GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { grafanaRulesNav } from '../../utils/navigation';
import { getRulePermissions } from '../rule-row/rulePermissions';

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleActionsProps {
  searchHit: AlertRuleSearchHit;
  rule: AlertRule | undefined;
  ruleIsLoading?: boolean;
}

export function AlertRuleActions({ searchHit, rule, ruleIsLoading = false }: AlertRuleActionsProps) {
  const { uid, title } = searchHit;
  const perms = getRulePermissions(rule, ruleIsLoading);

  const [showSilenceDrawer, setShowSilenceDrawer] = useState(false);
  const [showEnrichmentDrawer, setShowEnrichmentDrawer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [redirectToClone, setRedirectToClone] = useState(false);

  const [deleteAlertRule] = useDeleteAlertRuleMutation();
  const [updateAlertRule, { isLoading: isPausing }] = useUpdateAlertRuleMutation();

  const { isAvailable: isAssistantAvailable } = useAssistant();
  const enrichmentReadAbility = useEnrichmentAbility(EnrichmentAction.Read);
  const alertEnrichmentEnabled = useFlagAlertEnrichment();
  const alertingEnrichmentPerRuleEnabled = useFlagAlertingEnrichmentPerRule();
  const canManageEnrichments =
    isGranted(enrichmentReadAbility) && alertEnrichmentEnabled && alertingEnrichmentPerRuleEnabled;

  const isPaused = rule?.spec?.paused ?? false;

  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const canDuplicate = createSupported && createAllowed && !perms.isPluginManaged;

  const identifier: GrafanaRuleIdentifier = { ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid };

  const handlePauseResume = async () => {
    const result = await updateAlertRule({ name: uid, patch: { spec: { paused: !isPaused } } });
    if ('error' in result) {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.actions.pause-error', 'Failed to {{action}} rule', {
          action: isPaused
            ? t('alerting.gma-rule-list.actions.resume', 'resume')
            : t('alerting.gma-rule-list.actions.pause', 'pause'),
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

  const menu = (
    <Menu>
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.view', 'View')}
        icon="eye"
        url={grafanaRulesNav.viewLink(uid)}
      />
      {canDuplicate && (
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
      {perms.canPause && (
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
      {perms.canDelete && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.delete', 'Delete')}
          icon="trash-alt"
          destructive
          onClick={() => setShowDeleteConfirm(true)}
        />
      )}
      {(isAssistantAvailable || canManageEnrichments) && <Menu.Divider />}
      {isAssistantAvailable && rule && <AnalyzeRuleButton alertRule={rule} />}
      {canManageEnrichments && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.manage-enrichments', 'Manage enrichments')}
          icon="info-circle"
          onClick={() => setShowEnrichmentDrawer(!showEnrichmentDrawer)}
        />
      )}
      <Menu.Divider />
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.silence', 'Silence notifications')}
        icon="bell-slash"
        onClick={() => setShowSilenceDrawer(true)}
      />
    </Menu>
  );

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {(perms.canEdit || perms.isLoading) && (
        <LinkButton
          size="sm"
          variant="secondary"
          fill="text"
          href={perms.canEdit ? grafanaRulesNav.editLink(uid) : '#'}
          disabled={perms.isLoading}
          aria-disabled={perms.isLoading}
        >
          <Trans i18nKey="common.edit">Edit</Trans>
        </LinkButton>
      )}

      <Dropdown overlay={menu}>
        <MoreButton disabled={perms.isLoading} />
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
          isProvisioned={perms.isRestricted}
          onDismiss={() => setRedirectToClone(false)}
        />
      )}
    </Stack>
  );
}
