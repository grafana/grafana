import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { Fragment, useMemo, useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useFlagGrafanaCustomDashboardTemplates } from '@grafana/runtime/internal';
import { Menu, Dropdown, ToolbarButton, useTheme2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { NewDashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/analytics/main';
import { CONTENT_KINDS, SOURCE_ENTRY_POINTS } from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { useTemplateDashboardsAvailability } from 'app/features/dashboard/dashgrid/DashboardLibrary/hooks/useTemplateDashboardsAvailability';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { GenerateDashboardModal } from 'app/features/dashboard-scene/assistant/generate/GenerateDashboardModal';
import { AccessControlAction } from 'app/types/accessControl';
import { ShowModalReactEvent } from 'app/types/events';
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
  const isCustomDashboardTemplatesEnabled = useFlagGrafanaCustomDashboardTemplates();
  const { isAvailable: isTemplateDashboardsAvailable } = useTemplateDashboardsAvailability();
  const { isAvailable: isAssistantAvailable } = useAssistant();
  // Only show "Generate dashboard" when the user can actually create dashboards — no point
  // launching the wizard if the final Save step would be blocked by permissions.
  const canCreateDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
  const isGenerateDashboardAvailable = isAssistantAvailable && canCreateDashboard;

  const theme = useTheme2();

  const actionGroups = useMemo(() => {
    const groups = findCreateActionGroups(navBarTree);

    if (isTemplateDashboardsAvailable) {
      const templateItem: NavModelItem = {
        id: 'browse-template-dashboard',
        text: t('navigation.quick-add.new-template-dashboard-button', 'Use template'),
        url: '/dashboards?templateDashboards=true&source=quickAdd',
        onClick: () => {
          isAnalyticsFrameworkEnabled
            ? NewDashboardLibraryInteractions.entryPointClicked({
                entryPoint: SOURCE_ENTRY_POINTS.QUICK_ADD_BUTTON,
                contentKind: isCustomDashboardTemplatesEnabled ? undefined : CONTENT_KINDS.TEMPLATE_DASHBOARD,
                contentKinds: isCustomDashboardTemplatesEnabled
                  ? [CONTENT_KINDS.CUSTOM_DASHBOARD_TEMPLATE, CONTENT_KINDS.TEMPLATE_DASHBOARD]
                  : [CONTENT_KINDS.TEMPLATE_DASHBOARD],
              })
            : DashboardLibraryInteractions.entryPointClicked({
                entryPoint: SOURCE_ENTRY_POINTS.QUICK_ADD_BUTTON,
                contentKind: isCustomDashboardTemplatesEnabled ? undefined : CONTENT_KINDS.TEMPLATE_DASHBOARD,
                contentKinds: isCustomDashboardTemplatesEnabled
                  ? [CONTENT_KINDS.CUSTOM_DASHBOARD_TEMPLATE, CONTENT_KINDS.TEMPLATE_DASHBOARD]
                  : [CONTENT_KINDS.TEMPLATE_DASHBOARD],
              });
        },
      };

      // Matches NavIDDashboards ("dashboards/browse") from pkg/services/navtree/models.go
      const dashboardGroup = groups.find((g) => g.parentId === 'dashboards/browse');
      if (dashboardGroup) {
        dashboardGroup.items.push(templateItem);
      }
    }

    if (isGenerateDashboardAvailable) {
      const generateItem: NavModelItem = {
        id: 'generate-dashboard',
        text: t('navigation.quick-add.generate-dashboard-button', 'Generate dashboard'),
        // No `url` — this item opens a modal rather than navigating.
        onClick: () => {
          appEvents.publish(new ShowModalReactEvent({ component: GenerateDashboardModal }));
        },
      };

      const dashboardGroup = groups.find((g) => g.parentId === 'dashboards/browse');
      if (dashboardGroup) {
        dashboardGroup.items.push(generateItem);
      }
    }

    return groups;
  }, [
    isAnalyticsFrameworkEnabled,
    isCustomDashboardTemplatesEnabled,
    isTemplateDashboardsAvailable,
    isGenerateDashboardAvailable,
    navBarTree,
  ]);

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
