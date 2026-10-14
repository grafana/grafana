import { Trans } from '@grafana/i18n';
import { logInfo } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { LogMessages } from '../../Analytics';
import { createRelativeUrl } from '../../utils/url';

/**
 * Page-header actions for the GMA-only Recording rules page: New recording rule only. No More
 * menu, Export all, Generate with AI, import, or Design-rule-for-provisioning action - those are
 * Alert-rule-specific or undecided for Recording rules.
 */
export function RecordingRulesHeaderActions() {
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);

  if (!canCreate) {
    return null;
  }

  return (
    <LinkButton
      href={createRelativeUrl('/alerting/new/grafana-recording')}
      icon="plus"
      onClick={() => logInfo(LogMessages.recordingRuleFromScratch)}
    >
      <Trans i18nKey="alerting.gma-rule-list.actions.new-recording-rule">New recording rule</Trans>
    </LinkButton>
  );
}
