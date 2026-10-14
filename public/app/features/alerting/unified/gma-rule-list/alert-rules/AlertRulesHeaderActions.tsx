import { Trans, t } from '@grafana/i18n';
import { logInfo } from '@grafana/runtime';
import { Dropdown, LinkButton, Menu, Stack } from '@grafana/ui';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { LogMessages } from '../../Analytics';
import { AIAlertRuleButtonComponent } from '../../enterprise-components/AI/AIGenAlertRuleButton/addAIAlertRuleButton';
import { createReturnTo } from '../../hooks/useReturnTo';
import { createRelativeUrl } from '../../utils/url';
import { MoreButton } from '../shared/MoreButton';

/**
 * Page-header actions for the GMA-only Alert rules page. Import/export-all/bulk/group actions,
 * and Recording/data-source-managed rule creation, are intentionally absent from this page.
 */
export function AlertRulesHeaderActions() {
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);
  const returnTo = createReturnTo();

  return (
    <Stack direction="row" gap={1}>
      {canCreate && (
        <LinkButton
          variant="primary"
          href={createRelativeUrl('/alerting/new/alerting', { returnTo })}
          icon="plus"
          onClick={() => logInfo(LogMessages.alertRuleFromScratch)}
        >
          <Trans i18nKey="alerting.gma-rule-list.actions.new-alert-rule">New alert rule</Trans>
        </LinkButton>
      )}
      {canCreate && <AIAlertRuleButtonComponent />}
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item
              label={t('alerting.gma-rule-list.actions.design-rule-for-provisioning', 'Design rule for provisioning')}
              icon="download-alt"
              url={createRelativeUrl('/alerting/export-new-rule', { returnTo })}
              onClick={() => logInfo(LogMessages.exportNewGrafanaRule)}
            />
          </Menu>
        }
        placement="bottom-end"
      >
        <MoreButton size="md" />
      </Dropdown>
    </Stack>
  );
}
