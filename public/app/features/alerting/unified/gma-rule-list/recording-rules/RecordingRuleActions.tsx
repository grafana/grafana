import { useState } from 'react';

import {
  type RecordingRule,
  useDeleteRecordingRuleMutation,
  useUpdateRecordingRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfirmModal, Dropdown, LinkButton, Menu, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { AnalyzeRuleButton } from 'app/features/alerting/unified/components/assistant/AnalizeRuleButton';
import { RedirectToCloneRule } from 'app/features/alerting/unified/components/rules/CloneRule';
import { isGranted } from 'app/features/alerting/unified/hooks/abilities/abilityUtils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { isK8sEntityProvisioned } from 'app/features/alerting/unified/utils/k8s/utils';
import { type GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { grafanaRulesNav } from '../../utils/navigation';

import { useRecordingRuleAbilities } from './useRecordingRuleAbilities';

interface RecordingRuleActionsProps {
  rule: RecordingRule;
}

export function RecordingRuleActions({ rule }: RecordingRuleActionsProps) {
  const uid = rule.metadata.name ?? '';
  const title = rule.spec.title ?? '';
  const abilities = useRecordingRuleAbilities(rule);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [redirectToClone, setRedirectToClone] = useState(false);

  const [deleteRecordingRule] = useDeleteRecordingRuleMutation();
  const [updateRecordingRule, { isLoading: isPausing }] = useUpdateRecordingRuleMutation();

  const { isAvailable: isAssistantAvailable } = useAssistant();

  const isPaused = rule.spec?.paused ?? false;
  const isProvisioned = isK8sEntityProvisioned(rule);

  const identifier: GrafanaRuleIdentifier = { ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid };

  const handlePauseResume = async () => {
    const result = await updateRecordingRule({ name: uid, patch: { spec: { paused: !isPaused } } });
    if ('error' in result) {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.recording-rule-actions.pause-error', 'Failed to {{action}} rule', {
          action: isPaused
            ? t('alerting.gma-rule-list.recording-rule-actions.resume-action', 'resume')
            : t('alerting.gma-rule-list.recording-rule-actions.pause-action', 'pause'),
          interpolation: { escapeValue: false },
        }),
      ]);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    const result = await deleteRecordingRule({ name: uid });
    if ('error' in result) {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.recording-rule-actions.delete-error', 'Failed to delete rule'),
      ]);
    }
  };

  const handleCopyLink = async () => {
    const url = grafanaRulesNav.shareLink(uid);
    try {
      await navigator.clipboard.writeText(url);
      appEvents.emit(AppEvents.alertSuccess, [
        t('alerting.gma-rule-list.recording-rule-actions.copy-link-success', 'Link copied'),
      ]);
    } catch {
      appEvents.emit(AppEvents.alertError, [
        t('alerting.gma-rule-list.recording-rule-actions.copy-link-error', 'Failed to copy link'),
      ]);
    }
  };

  const menu = (
    <Menu>
      <Menu.Item
        label={t('alerting.gma-rule-list.recording-rule-actions.view', 'View')}
        icon="eye"
        url={grafanaRulesNav.viewLink(uid)}
      />
      {isGranted(abilities.duplicate) && (
        <Menu.Item
          label={t('alerting.gma-rule-list.recording-rule-actions.duplicate', 'Duplicate')}
          icon="copy"
          onClick={() => setRedirectToClone(true)}
        />
      )}
      <Menu.Item
        label={t('alerting.gma-rule-list.recording-rule-actions.copy-link', 'Copy link')}
        icon="link"
        onClick={handleCopyLink}
      />
      {isGranted(abilities.pause) && (
        <>
          <Menu.Divider />
          <Menu.Item
            label={
              isPaused
                ? t('alerting.gma-rule-list.recording-rule-actions.resume', 'Resume')
                : t('alerting.gma-rule-list.recording-rule-actions.pause', 'Pause')
            }
            icon={isPaused ? 'play' : 'pause'}
            onClick={handlePauseResume}
            disabled={isPausing}
          />
        </>
      )}
      {isGranted(abilities.delete) && (
        <Menu.Item
          label={t('alerting.gma-rule-list.recording-rule-actions.delete', 'Delete')}
          icon="trash-alt"
          destructive
          onClick={() => setShowDeleteConfirm(true)}
        />
      )}
      {isAssistantAvailable && (
        <>
          <Menu.Divider />
          <AnalyzeRuleButton recordingRule={rule} />
        </>
      )}
    </Menu>
  );

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {isGranted(abilities.edit) && (
        <LinkButton size="sm" variant="secondary" fill="text" href={grafanaRulesNav.editLink(uid)}>
          <Trans i18nKey="common.edit">Edit</Trans>
        </LinkButton>
      )}

      <Dropdown overlay={menu}>
        <MoreButton />
      </Dropdown>

      {showDeleteConfirm && (
        <ConfirmModal
          isOpen
          title={t('alerting.gma-rule-list.recording-rule-actions.delete-confirm-title', 'Delete recording rule')}
          body={t('alerting.gma-rule-list.recording-rule-actions.delete-confirm-body', 'Delete "{{title}}"?', {
            title,
            interpolation: { escapeValue: false },
          })}
          confirmText={t('alerting.gma-rule-list.recording-rule-actions.delete-confirm-button', 'Delete')}
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
