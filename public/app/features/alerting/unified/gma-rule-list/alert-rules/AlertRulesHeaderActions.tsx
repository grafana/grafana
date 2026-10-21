import { Trans, t } from '@grafana/i18n';
import { logInfo } from '@grafana/runtime';
import { Dropdown, LinkButton, Menu, Stack } from '@grafana/ui';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { LogMessages } from '../../Analytics';
import { grafanaRulesNav } from '../../utils/navigation';
import { MoreButton } from '../shared/MoreButton';

/** Import/export-all/bulk/group actions are intentionally absent. */
export function AlertRulesHeaderActions() {
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);

  return (
    <Stack direction="row" gap={1}>
      {canCreate && (
        <LinkButton
          variant="primary"
          href={grafanaRulesNav.newAlertRuleLink()}
          icon="plus"
          onClick={() => logInfo(LogMessages.alertRuleFromScratch)}
        >
          <Trans i18nKey="alerting.gma-rule-list.actions.new-alert-rule">New alert rule</Trans>
        </LinkButton>
      )}
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item
              label={t('alerting.gma-rule-list.actions.design-rule-for-provisioning', 'Design rule for provisioning')}
              icon="download-alt"
              url={grafanaRulesNav.exportNewRuleLink()}
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
