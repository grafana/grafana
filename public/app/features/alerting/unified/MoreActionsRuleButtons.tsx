import { isEmpty } from 'lodash';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useToggle } from 'react-use';

import { urlUtil } from '@grafana/data';
import { Button, Dropdown, Icon, LinkButton, Menu, MenuItem } from '@grafana/ui';

import { logInfo, LogMessages } from './Analytics';
import { GrafanaRulesExporter } from './components/export/GrafanaRulesExporter';
import { AlertingAction, useAlertingAbility } from './hooks/useAbilities';

interface Props {
  enableExport?: boolean;
}

export function MoreActionsRuleButtons({ enableExport }: Props) {
  const [createRuleSupported, createRuleAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const [createCloudRuleSupported, createCloudRuleAllowed] = useAlertingAbility(AlertingAction.CreateExternalAlertRule);
  const [exportRulesSupported, exportRulesAllowed] = useAlertingAbility(AlertingAction.ExportGrafanaManagedRules);

  const location = useLocation();
  const [showExportDrawer, toggleShowExportDrawer] = useToggle(false);

  const canCreateGrafanaRules = createRuleSupported && createRuleAllowed;
  const canCreateCloudRules = createCloudRuleSupported && createCloudRuleAllowed;
  const canExportRules = exportRulesSupported && exportRulesAllowed;

  const menuItems: JSX.Element[] = [];

  if (canCreateGrafanaRules || canCreateCloudRules) {
    menuItems.push(
      <MenuItem
        label="New recording rule"
        key="new-recording-rule"
        url={urlUtil.renderUrl(`alerting/new/recording`, {
          returnTo: location.pathname + location.search,
        })}
      />
    );
  }

  if (canExportRules) {
    menuItems.push(
      <MenuItem
        label="Export all Grafana-managed rules"
        key="export-all-rules"
        onClick={toggleShowExportDrawer}
        disabled={!enableExport}
        description={enableExport ? '' : 'No Grafana-managed rules found'}
      />
    );
  }

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

      {!isEmpty(menuItems) && (
        <Dropdown overlay={<Menu>{menuItems}</Menu>}>
          <Button variant="secondary">
            More
            <Icon name="angle-down" />
          </Button>
        </Dropdown>
      )}
      {canExportRules && showExportDrawer && <GrafanaRulesExporter onClose={toggleShowExportDrawer} />}
    </>
  );
}
