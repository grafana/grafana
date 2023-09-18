import React from 'react';
import { useLocation } from 'react-router-dom';
import { useToggle } from 'react-use';

import { urlUtil } from '@grafana/data';
import { Button, Dropdown, Icon, LinkButton, Menu, MenuItem } from '@grafana/ui';

import { logInfo, LogMessages } from './Analytics';
import { GrafanaRulesExporter } from './components/export/GrafanaRulesExporter';
import { useRulesAccess } from './utils/accessControlHooks';

interface Props {}

export function MoreActionsRuleButtons({}: Props) {
  const { canCreateGrafanaRules, canCreateCloudRules, canReadProvisioning } = useRulesAccess();
  const location = useLocation();
  const [showExportDrawer, toggleShowExportDrawer] = useToggle(false);
  const newMenu = (
    <Menu>
      {(canCreateGrafanaRules || canCreateCloudRules) && (
        <MenuItem
          url={urlUtil.renderUrl(`alerting/new/recording`, {
            returnTo: location.pathname + location.search,
          })}
          label="New recording rule"
        />
      )}
      {canReadProvisioning && <MenuItem onClick={toggleShowExportDrawer} label="Export all Grafana-managed rules" />}
    </Menu>
  );

  return (
    <>
      {(canCreateGrafanaRules || canCreateCloudRules) && (
        <LinkButton
          href={urlUtil.renderUrl('alerting/new/alerting', { returnTo: location.pathname + location.search })}
          icon="plus"
          onClick={() => logInfo(LogMessages.alertRuleFromScratch)}
        >
          New alert rule
        </LinkButton>
      )}

      <Dropdown overlay={newMenu}>
        <Button variant="secondary">
          More
          <Icon name="angle-down" />
        </Button>
      </Dropdown>
      {showExportDrawer && <GrafanaRulesExporter onClose={toggleShowExportDrawer} />}
    </>
  );
}
