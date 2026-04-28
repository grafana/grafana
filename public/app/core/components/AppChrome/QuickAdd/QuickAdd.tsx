import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { Fragment, useMemo, useState } from 'react';

import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv, reportInteraction, config } from '@grafana/runtime';
import { Menu, Dropdown, ToolbarButton } from '@grafana/ui';
import { useTheme2 } from '@grafana/ui/themes';
import { NewDashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/analytics/main';
import { CONTENT_KINDS, SOURCE_ENTRY_POINTS } from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { useSelector } from 'app/types/store';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import {
  ALERTING_GROUP_COLOR_DARK_NAME,
  ALERTING_GROUP_COLOR_LIGHT_NAME,
  DASHBOARD_GROUP_COLOR_NAME,
  ITEM_ICONS,
  findCreateActionGroups,
} from './utils';

export interface Props {}

export const QuickAdd = ({}: Props) => {
  const navBarTree = useSelector((state) => state.navBarTree);
  const [isOpen, setIsOpen] = useState(false);
  const isAnalyticsFrameworkEnabled = useBooleanFlagValue('analyticsFramework', true);
  const theme = useTheme2();

  const actionGroups = useMemo(() => {
    const groups = findCreateActionGroups(navBarTree);

    if (config.featureToggles.dashboardTemplates) {
      const testDataSources = getDataSourceSrv().getList({ type: 'grafana-testdata-datasource' });
      if (testDataSources.length > 0) {
        const templateItem: NavModelItem = {
          id: 'browse-template-dashboard',
          text: t('navigation.quick-add.new-template-dashboard-button', 'Use template'),
          url: '/dashboards?templateDashboards=true&source=quickAdd',
          onClick: () => {
            isAnalyticsFrameworkEnabled
              ? NewDashboardLibraryInteractions.entryPointClicked({
                  entryPoint: SOURCE_ENTRY_POINTS.QUICK_ADD_BUTTON,
                  contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
                })
              : DashboardLibraryInteractions.entryPointClicked({
                  entryPoint: SOURCE_ENTRY_POINTS.QUICK_ADD_BUTTON,
                  contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
                });
          },
        };

        // Matches NavIDDashboards ("dashboards/browse") from pkg/services/navtree/models.go
        const dashboardGroup = groups.find((g) => g.parentId === 'dashboards/browse');
        if (dashboardGroup) {
          dashboardGroup.items.push(templateItem);
        }
      }
    }

    return groups;
  }, [isAnalyticsFrameworkEnabled, navBarTree]);

  const showQuickAdd = actionGroups.some((g) => g.items.length > 0);

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

  const MenuActions = () => {
    const groupColors: Record<string, string> = {
      'dashboards/browse': theme.visualization.getColorByName(DASHBOARD_GROUP_COLOR_NAME),
      alerting:
        theme.colors.mode === 'dark'
          ? theme.visualization.getColorByName(ALERTING_GROUP_COLOR_LIGHT_NAME)
          : theme.visualization.getColorByName(ALERTING_GROUP_COLOR_DARK_NAME),
    };

    return (
      <Menu>
        {actionGroups.map((group, groupIdx) => {
          const iconColor = groupColors[group.parentId];
          return (
            <Fragment key={group.parentId}>
              {groupIdx > 0 && <Menu.Divider />}
              {/* Empty parentText (ungrouped items) becomes undefined to suppress the group header */}
              <Menu.Group label={group.parentText || undefined}>
                {group.items.map((item) => {
                  return (
                    <Menu.Item
                      key={item.id ?? item.url}
                      url={item.url}
                      label={item.text}
                      icon={item.id ? ITEM_ICONS[item.id] : undefined}
                      iconColor={iconColor}
                      onClick={() => {
                        reportInteraction('grafana_menu_item_clicked', { url: item.url, from: 'quickadd' });
                        item.onClick?.();
                      }}
                    />
                  );
                })}
              </Menu.Group>
            </Fragment>
          );
        })}
      </Menu>
    );
  };

  return (
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
  );
};
