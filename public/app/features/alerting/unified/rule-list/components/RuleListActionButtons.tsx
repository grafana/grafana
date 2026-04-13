import { memo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { logInfo } from '@grafana/runtime';
import { LinkButton, Stack } from '@grafana/ui';

import { LogMessages } from '../../Analytics';
import { AIAlertRuleButtonComponent } from '../../enterprise-components/AI/AIGenAlertRuleButton/addAIAlertRuleButton';
import { useExternalRuleAbility, useRuleAbility } from '../../hooks/abilities/ruleAbilities';
import { ExternalRuleAction, RuleAction } from '../../hooks/abilities/types';
import { createReturnTo } from '../../hooks/useReturnTo';
import { createRelativeUrl } from '../../utils/url';

interface RuleListActionButtonsProps {
  hasAlertRulesCreated: boolean;
}

export const RuleListActionButtons = memo<RuleListActionButtonsProps>(({ hasAlertRulesCreated }) => {
  if (!hasAlertRulesCreated) {
    return null;
  }

  return (
    <Stack gap={1}>
      <CreateAlertButtons />
      <ExportNewRuleButton />
    </Stack>
  );
});

RuleListActionButtons.displayName = 'RuleListActionButtons';

function CreateAlertButtons() {
  const { granted: canCreateGrafanaRules } = useRuleAbility(RuleAction.Create);
  const { granted: canCreateCloudRules } = useExternalRuleAbility(ExternalRuleAction.CreateAlertRule);

  const returnTo = createReturnTo();

  if (canCreateGrafanaRules || canCreateCloudRules) {
    return (
      <Stack direction="row" gap={1}>
        {canCreateGrafanaRules && <AIAlertRuleButtonComponent />}
        <LinkButton
          href={createRelativeUrl('/alerting/new/alerting', { returnTo })}
          icon="plus"
          onClick={() => logInfo(LogMessages.alertRuleFromScratch)}
        >
          <Trans i18nKey="alerting.rule-list.new-alert-rule">New alert rule</Trans>
        </LinkButton>
      </Stack>
    );
  }
  return null;
}

function ExportNewRuleButton() {
  const returnTo = createReturnTo();
  const url = createRelativeUrl(`/alerting/export-new-rule`, {
    returnTo,
  });
  return (
    <LinkButton
      href={url}
      icon="download-alt"
      variant="secondary"
      tooltip={t('alerting.export-new-rule-button.tooltip-export-new-grafana-rule', 'Export new grafana rule')}
      onClick={() => logInfo(LogMessages.exportNewGrafanaRule)}
    >
      <Trans i18nKey="alerting.list-view.section.grafanaManaged.export-new-rule">Export rule definition</Trans>
    </LinkButton>
  );
}
