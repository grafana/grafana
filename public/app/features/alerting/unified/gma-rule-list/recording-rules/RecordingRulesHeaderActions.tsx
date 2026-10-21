import { Trans } from '@grafana/i18n';
import { logInfo } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { LogMessages } from '../../Analytics';
import { grafanaRulesNav } from '../../utils/navigation';

export function RecordingRulesHeaderActions() {
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);

  if (!canCreate) {
    return null;
  }

  return (
    <LinkButton
      href={grafanaRulesNav.newRecordingRuleLink()}
      icon="plus"
      onClick={() => logInfo(LogMessages.recordingRuleFromScratch)}
    >
      <Trans i18nKey="alerting.gma-rule-list.actions.new-recording-rule">New recording rule</Trans>
    </LinkButton>
  );
}
