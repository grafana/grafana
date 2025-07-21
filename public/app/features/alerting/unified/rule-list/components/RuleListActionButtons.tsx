import { memo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { logInfo } from '@grafana/runtime';
import { LinkButton, Stack } from '@grafana/ui';

import { LogMessages } from '../../Analytics';
import { AIAlertRuleButtonComponent } from '../../enterprise-components/AI/AIGenAlertRuleButton/addAIAlertRuleButton';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { createRelativeUrl } from '../../utils/url';

interface RuleListActionButtonsProps {
  hasAlertRulesCreated: boolean;
  canCreateGrafanaRules: boolean;
}

export const RuleListActionButtons = memo<RuleListActionButtonsProps>(
  ({ hasAlertRulesCreated, canCreateGrafanaRules }) => {
    if (!hasAlertRulesCreated) {
      return null;
    }

    return (
      <Stack gap={1}>
        {canCreateGrafanaRules && <AIAlertRuleButtonComponent />}
        <CreateAlertButton />
        <ExportNewRuleButton />
      </Stack>
    );
  }
);

RuleListActionButtons.displayName = 'RuleListActionButtons';

export function CreateAlertButton() {
  const [createRuleSupported, createRuleAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const [createCloudRuleSupported, createCloudRuleAllowed] = useAlertingAbility(AlertingAction.CreateExternalAlertRule);

  const location = useLocation();

  const canCreateCloudRules = createCloudRuleSupported && createCloudRuleAllowed;
  const canCreateGrafanaRules = createRuleSupported && createRuleAllowed;

  if (canCreateGrafanaRules || canCreateCloudRules) {
    return (
      <Stack direction="row" gap={1}>
        <LinkButton
          href={urlUtil.renderUrl('alerting/new/alerting', { returnTo: location.pathname + location.search })}
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
  const returnTo = window.location.pathname + window.location.search;
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
