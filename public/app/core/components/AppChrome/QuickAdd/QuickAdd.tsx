import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { getDataSourceSrv, reportInteraction, config } from '@grafana/runtime';
import { Dropdown, Menu, ToolbarButton, useTheme2 } from '@grafana/ui';
import { NewDashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/analytics/main';
import { CONTENT_KINDS, SOURCE_ENTRY_POINTS } from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { useSelector } from 'app/types/store';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { findCreateActions } from './utils';

export interface Props {}

export const QuickAdd = ({}: Props) => {
  const navBarTree = useSelector((state) => state.navBarTree);
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme2();
  const isAnalyticsFrameworkEnabled = useBooleanFlagValue('analyticsFramework', true);

  const createActions = useMemo(() => findCreateActions(navBarTree), [navBarTree]);

  const canCreateDashboard = createActions.some((a) => a.id === 'dashboards/new');
  const canImportDashboard = createActions.some((a) => a.id === 'dashboards/import');
  const canCreateAlertRule = createActions.some((a) => a.id === 'alert');

  const showTemplateAction = useMemo(() => {
    if (!config.featureToggles.dashboardTemplates) {
      return false;
    }
    const testDataSources = getDataSourceSrv().getList({ type: 'grafana-testdata-datasource' });
    return testDataSources.length > 0;
  }, []);

  const showDashboardGroup = canCreateDashboard || canImportDashboard || showTemplateAction;
  const showQuickAdd = showDashboardGroup || canCreateAlertRule;

  if (!showQuickAdd) {
    return null;
  }

  const handleVisibleChange = () => {
    if (!isOpen) {
      reportInteraction('grafana_create_new_button_menu_opened', {
        from: 'quickadd',
      });
    }
    setIsOpen(!isOpen);
  };

  const handleMenuItemClick = (url: string, extraOnClick?: () => void) => {
    reportInteraction('grafana_menu_item_clicked', { url, from: 'quickadd' });
    extraOnClick?.();
  };

  const MenuActions = () => {
    const dashboardNewUrl = createActions.find((a) => a.id === 'dashboards/new')?.url ?? '/dashboard/new';
    const dashboardImportUrl = createActions.find((a) => a.id === 'dashboards/import')?.url ?? '/dashboard/import';
    const alertNewUrl = createActions.find((a) => a.id === 'alert')?.url ?? '/alerting/new';
    const templateUrl = '/dashboards?templateDashboards=true&source=quickAdd';

    return (
      <Menu>
        {showDashboardGroup && (
          <Menu.Group label={t('navigation.quick-add.new-dashboard-group', 'New dashboard')}>
            {canCreateDashboard && (
              <Menu.Item
                label={t('navigation.quick-add.blank', 'Blank')}
                icon="plus"
                iconColor={theme.colors.success.text}
                url={dashboardNewUrl}
                onClick={() => handleMenuItemClick(dashboardNewUrl)}
              />
            )}
            {showTemplateAction && (
              <Menu.Item
                label={t('navigation.quick-add.from-template', 'From template')}
                icon="table"
                iconColor={theme.colors.success.text}
                url={templateUrl}
                onClick={() =>
                  handleMenuItemClick(templateUrl, () =>
                    isAnalyticsFrameworkEnabled
                      ? NewDashboardLibraryInteractions.entryPointClicked({
                          entryPoint: SOURCE_ENTRY_POINTS.QUICK_ADD_BUTTON,
                          contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
                        })
                      : DashboardLibraryInteractions.entryPointClicked({
                          entryPoint: SOURCE_ENTRY_POINTS.QUICK_ADD_BUTTON,
                          contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
                        })
                  )
                }
              />
            )}
            {canImportDashboard && (
              <Menu.Item
                label={t('navigation.quick-add.import', 'Import')}
                icon="download-alt"
                iconColor={theme.colors.success.text}
                url={dashboardImportUrl}
                onClick={() => handleMenuItemClick(dashboardImportUrl)}
              />
            )}
          </Menu.Group>
        )}
        {showDashboardGroup && canCreateAlertRule && <Menu.Divider />}
        {canCreateAlertRule && (
          <Menu.Group label={t('navigation.quick-add.new-alert-rule-group', 'New alert rule')}>
            <Menu.Item
              label={t('navigation.quick-add.create', 'Create')}
              icon="plus"
              iconColor={theme.colors.success.text}
              url={alertNewUrl}
              onClick={() => handleMenuItemClick(alertNewUrl)}
            />
          </Menu.Group>
        )}
      </Menu>
    );
  };

  return showQuickAdd ? (
    <>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={handleVisibleChange}>
        <ToolbarButton
          iconOnly
          icon={'plus'}
          isOpen={isOpen}
          aria-label={t('navigation.quick-add.aria-label', 'New')}
        />
      </Dropdown>
      <NavToolbarSeparator />
    </>
  ) : null;
};
