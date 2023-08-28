import React from 'react';
import { useLocation } from 'react-router-dom';

import { urlUtil } from '@grafana/data';
import { Button, Dropdown, Icon, LinkButton, Menu, MenuItem } from '@grafana/ui';

import { logInfo, LogMessages } from './Analytics';
import { useRulesAccess } from './utils/accessControlHooks';
import { createUrl } from './utils/url';

interface Props {}

export function MoreActionsRuleButtons({}: Props) {
  const { canCreateGrafanaRules, canCreateCloudRules, canReadProvisioning } = useRulesAccess();
  const location = useLocation();
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
      {canReadProvisioning && (
        <MenuItem
          url={createUrl('/api/v1/provisioning/alert-rules/export', {
            download: 'true',
            format: 'yaml',
          })}
          label="Export all"
          target="_blank"
        />
      )}
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
    </>
  );
}
