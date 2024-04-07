import {
  getTimeZone,
  PanelMenuItem,
  PluginExtensionPoints,
  urlUtil,
  type PluginExtensionPanelContext,
} from '@grafana/data';
import { AngularComponent, getPluginLinkExtensions, locationService } from '@grafana/runtime';
import { PanelCtrl } from 'app/angular/panel/panel_ctrl';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';
import { panelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import {
  addLibraryPanel,
  copyPanel,
  duplicatePanel,
  removePanel,
  // sharePanel, // LOGZ.IO GRAFANA CHANGE :: hide share for now
  toggleLegend,
  unlinkLibraryPanel,
} from 'app/features/dashboard/utils/panel';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { InspectTab } from 'app/features/inspector/types';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { createExtensionSubMenu } from 'app/features/plugins/extensions/utils';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { store } from 'app/store/store';

import { getCreateAlertInMenuAvailability } from '../../alerting/unified/utils/access-control';
import { navigateToExplore } from '../../explore/state/main';
import { getTimeSrv } from '../services/TimeSrv';

export function getPanelMenu(
  dashboard: DashboardModel,
  panel: PanelModel,
  angularComponent?: AngularComponent | null
): PanelMenuItem[] {
  const onViewPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    locationService.partial({
      viewPanel: panel.id,
    });
    DashboardInteractions.panelMenuItemClicked('view');
  };

  const onEditPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    locationService.partial({
      editPanel: panel.id,
    });

    DashboardInteractions.panelMenuItemClicked('edit');
  };

  // LOGZ.IO GRAFANA CHANGE :: hide share for now
  // const onSharePanel = (event: React.MouseEvent<any>) => {
  //   event.preventDefault();
  //   sharePanel(dashboard, panel);
  // };

  const onAddLibraryPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    addLibraryPanel(dashboard, panel);
    DashboardInteractions.panelMenuItemClicked('createLibraryPanel');
  };

  const onUnlinkLibraryPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    unlinkLibraryPanel(panel);
    DashboardInteractions.panelMenuItemClicked('unlinkLibraryPanel');
  };

  const onInspectPanel = (tab?: InspectTab) => {
    locationService.partial({
      inspect: panel.id,
      inspectTab: tab,
    });
    DashboardInteractions.panelMenuInspectClicked(tab ?? InspectTab.Data);
  };

  const onMore = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const onDuplicatePanel = (event: React.MouseEvent) => {
    event.preventDefault();
    duplicatePanel(dashboard, panel);
    DashboardInteractions.panelMenuItemClicked('duplicate');
  };

  const onCopyPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    copyPanel(panel);
    DashboardInteractions.panelMenuItemClicked('copy');
  };

  const onRemovePanel = (event: React.MouseEvent) => {
    event.preventDefault();
    removePanel(dashboard, panel, true);
    DashboardInteractions.panelMenuItemClicked('remove');
  };

  const onNavigateToExplore = (event: React.MouseEvent) => {
    event.preventDefault();
    const openInNewWindow =
      event.ctrlKey || event.metaKey ? (url: string) => window.open(`${config.appSubUrl}${url}`) : undefined;
    store.dispatch(
      navigateToExplore(panel, {
        timeRange: getTimeSrv().timeRange(),
        getExploreUrl,
        openInNewWindow,
      }) as any
    );
    DashboardInteractions.panelMenuItemClicked('explore');
  };

  const onToggleLegend = (event: React.MouseEvent) => {
    event.preventDefault();
    toggleLegend(panel);
    DashboardInteractions.panelMenuItemClicked('toggleLegend');
  };

  const menu: PanelMenuItem[] = [];

  if (!panel.isEditing) {
    menu.push({
      text: t('panel.header-menu.view', `View`),
      iconClassName: 'eye',
      onClick: onViewPanel,
      shortcut: 'v',
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing) {
    menu.push({
      text: t('panel.header-menu.edit', `Edit`),
      iconClassName: 'edit',
      onClick: onEditPanel,
      shortcut: 'e',
    });
  }

// LOGZ.IO GRAFANA CHANGE :: hide share for now
//menu.push({
//  text: t('panel.header-menu.share', `Share`),
//  iconClassName: 'share-alt',
//  onClick: onSharePanel,
//  shortcut: 'p s',
//});

  if (
    contextSrv.hasAccessToExplore() &&
    !(panel.plugin && panel.plugin.meta.skipDataQuery) &&
    panel.datasource?.uid !== SHARED_DASHBOARD_QUERY
  ) {
    menu.push({
      text: t('panel.header-menu.explore', `Explore`),
      iconClassName: 'compass',
      onClick: onNavigateToExplore,
      shortcut: 'p x',
    });
  }

  const inspectMenu: PanelMenuItem[] = [];

  // Only show these inspect actions for data plugins
  if (panel.plugin && !panel.plugin.meta.skipDataQuery) {
    inspectMenu.push({
      text: t('panel.header-menu.inspect-data', `Data`),
      onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.Data),
    });

    if (dashboard.meta.canEdit) {
      inspectMenu.push({
        text: t('panel.header-menu.query', `Query`),
        onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.Query),
      });
    }
  }

  inspectMenu.push({
    text: t('panel.header-menu.inspect-json', `Panel JSON`),
    onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.JSON),
  });

  menu.push({
    type: 'submenu',
    text: t('panel.header-menu.inspect', `Inspect`),
    iconClassName: 'info-circle',
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      const currentTarget = e.currentTarget;
      const target = e.target;

      if (
        target === currentTarget ||
        (target instanceof HTMLElement && target.closest('[role="menuitem"]') === currentTarget)
      ) {
        onInspectPanel();
      }
    },
    shortcut: 'i',
    subMenu: inspectMenu,
  });

  const createAlert = async () => {
    const formValues = await panelToRuleFormValues(panel, dashboard);

    const ruleFormUrl = urlUtil.renderUrl('/alerting/new', {
      defaults: JSON.stringify(formValues),
      returnTo: location.pathname + location.search,
    });

    locationService.push(ruleFormUrl);
  };

  const onCreateAlert = (event: React.MouseEvent) => {
    event.preventDefault();
    createAlert();
    DashboardInteractions.panelMenuItemClicked('create-alert');
  };

  const subMenu: PanelMenuItem[] = [];
  const canEdit = dashboard.canEditPanel(panel);
  const isCreateAlertMenuOptionAvailable = getCreateAlertInMenuAvailability();

  if (!(panel.isViewing || panel.isEditing)) {
    if (canEdit) {
      subMenu.push({
        text: t('panel.header-menu.duplicate', `Duplicate`),
        onClick: onDuplicatePanel,
        shortcut: 'p d',
      });

      subMenu.push({
        text: t('panel.header-menu.copy', `Copy`),
        onClick: onCopyPanel,
      });

      if (isPanelModelLibraryPanel(panel)) {
        subMenu.push({
          text: t('panel.header-menu.unlink-library-panel', `Unlink library panel`),
          onClick: onUnlinkLibraryPanel,
        });
      } else {
        subMenu.push({
          text: t('panel.header-menu.create-library-panel', `Create library panel`),
          onClick: onAddLibraryPanel,
        });
      }
    } else if (contextSrv.isEditor) {
      // An editor but the dashboard is not editable
      subMenu.push({
        text: t('panel.header-menu.copy', `Copy`),
        onClick: onCopyPanel,
      });
    }
  }

  if (isCreateAlertMenuOptionAvailable) {
    subMenu.push({
      text: t('panel.header-menu.new-alert-rule', `New alert rule`),
      onClick: onCreateAlert,
    });
  }

  // add old angular panel options
  if (angularComponent) {
    const scope = angularComponent.getScope();
    const panelCtrl: PanelCtrl = scope.$$childHead.ctrl;
    const angularMenuItems = panelCtrl.getExtendedMenu();

    for (const item of angularMenuItems) {
      const reactItem: PanelMenuItem = {
        text: item.text,
        href: item.href,
        shortcut: item.shortcut,
      };

      if (item.click) {
        reactItem.onClick = () => {
          scope.$eval(item.click, { ctrl: panelCtrl });
        };
      }

      subMenu.push(reactItem);
    }
  }

  if (panel.options.legend) {
    subMenu.push({
      text: panel.options.legend.showLegend
        ? t('panel.header-menu.hide-legend', 'Hide legend')
        : t('panel.header-menu.show-legend', 'Show legend'),
      onClick: onToggleLegend,
      shortcut: 'p l',
    });
  }

  // When editing hide most actions
  if (panel.isEditing) {
    subMenu.length = 0;
    if (isCreateAlertMenuOptionAvailable) {
      subMenu.push({
        text: t('panel.header-menu.new-alert-rule', `New alert rule`),
        onClick: onCreateAlert,
      });
    }
  }

  if (canEdit && panel.plugin && !panel.plugin.meta.skipDataQuery) {
    subMenu.push({
      text: t('panel.header-menu.get-help', 'Get help'),
      onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.Help),
    });
  }

  const { extensions } = getPluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
    context: createExtensionContext(panel, dashboard),
    limitPerPlugin: 3,
  });

  if (extensions.length > 0 && !panel.isEditing) {
    menu.push({
      text: 'Extensions',
      iconClassName: 'plug',
      type: 'submenu',
      subMenu: createExtensionSubMenu(extensions),
    });
  }

  if (subMenu.length) {
    menu.push({
      type: 'submenu',
      text: t('panel.header-menu.more', `More...`),
      iconClassName: 'cube',
      subMenu,
      onClick: onMore,
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing && !panel.isViewing) {
    menu.push({ type: 'divider', text: '' });

    menu.push({
      text: t('panel.header-menu.remove', `Remove`),
      iconClassName: 'trash-alt',
      onClick: onRemovePanel,
      shortcut: 'p r',
    });
  }

  return menu;
}

function createExtensionContext(panel: PanelModel, dashboard: DashboardModel): PluginExtensionPanelContext {
  return {
    id: panel.id,
    pluginId: panel.type,
    title: panel.title,
    timeRange: dashboard.time,
    timeZone: getTimeZone({
      timeZone: dashboard.timezone,
    }),
    dashboard: {
      uid: dashboard.uid,
      title: dashboard.title,
      tags: Array.from<string>(dashboard.tags),
    },
    targets: panel.targets,
    scopedVars: panel.scopedVars,
    data: panel.getQueryRunner().getLastResult(),
  };
}
