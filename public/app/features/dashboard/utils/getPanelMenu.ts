import { PanelMenuItem, PluginExtensionPoints, type PluginExtensionPanelContext } from '@grafana/data';
import {
  isPluginExtensionLink,
  AngularComponent,
  getDataSourceSrv,
  getPluginExtensions,
  locationService,
  reportInteraction,
} from '@grafana/runtime';
import { PanelCtrl } from 'app/angular/panel/panel_ctrl';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import {
  addLibraryPanel,
  copyPanel,
  duplicatePanel,
  removePanel,
  sharePanel,
  toggleLegend,
  unlinkLibraryPanel,
} from 'app/features/dashboard/utils/panel';
import { InspectTab } from 'app/features/inspector/types';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { store } from 'app/store/store';

import { navigateToExplore } from '../../explore/state/main';
import { getTimeSrv } from '../services/TimeSrv';

export function getPanelMenu(
  dashboard: DashboardModel,
  panel: PanelModel,
  angularComponent?: AngularComponent | null
): PanelMenuItem[] {
  const onViewPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    locationService.partial({
      viewPanel: panel.id,
    });
    reportInteraction('dashboards_panelheader_view_clicked');
  };

  const onEditPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    locationService.partial({
      editPanel: panel.id,
    });
    reportInteraction('dashboards_panelheader_edit_clicked');
  };

  const onSharePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    sharePanel(dashboard, panel);
    reportInteraction('dashboards_panelheader_share_clicked');
  };

  const onAddLibraryPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    addLibraryPanel(dashboard, panel);
    reportInteraction('dashboards_panelheader_createlibrarypanel_clicked');
  };

  const onUnlinkLibraryPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    unlinkLibraryPanel(panel);
    reportInteraction('dashboards_panelheader_unlinklibrarypanel_clicked');
  };

  const onInspectPanel = (tab?: InspectTab) => {
    locationService.partial({
      inspect: panel.id,
      inspectTab: tab,
    });
    reportInteraction('dashboards_panelheader_inspect_clicked', { tab: tab ?? InspectTab.Data });
  };

  const onMore = (event: React.MouseEvent<any>) => {
    event.preventDefault();
  };

  const onDuplicatePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    duplicatePanel(dashboard, panel);
    reportInteraction('dashboards_panelheader_duplicate_clicked');
  };

  const onCopyPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    copyPanel(panel);
    reportInteraction('dashboards_panelheader_copy_clicked');
  };

  const onRemovePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    removePanel(dashboard, panel, true);
    reportInteraction('dashboards_panelheader_remove_clicked');
  };

  const onNavigateToExplore = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    const openInNewWindow =
      event.ctrlKey || event.metaKey ? (url: string) => window.open(`${config.appSubUrl}${url}`) : undefined;
    store.dispatch(navigateToExplore(panel, { getDataSourceSrv, getTimeSrv, getExploreUrl, openInNewWindow }) as any);
    reportInteraction('dashboards_panelheader_explore_clicked');
  };

  const onToggleLegend = (event: React.MouseEvent) => {
    event.preventDefault();
    toggleLegend(panel);
    reportInteraction('dashboards_panelheader_togglelegend_clicked');
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

  menu.push({
    text: t('panel.header-menu.share', `Share`),
    iconClassName: 'share-alt',
    onClick: onSharePanel,
    shortcut: 'p s',
  });

  if (contextSrv.hasAccessToExplore() && !(panel.plugin && panel.plugin.meta.skipDataQuery)) {
    menu.push({
      text: t('panel.header-menu.explore', `Explore`),
      iconClassName: 'compass',
      onClick: onNavigateToExplore,
      shortcut: 'x',
    });
  }

  const inspectMenu: PanelMenuItem[] = [];

  // Only show these inspect actions for data plugins
  if (panel.plugin && !panel.plugin.meta.skipDataQuery) {
    inspectMenu.push({
      text: t('panel.header-menu.inspect-data', `Data`),
      onClick: (e: React.MouseEvent<any>) => onInspectPanel(InspectTab.Data),
    });

    if (dashboard.meta.canEdit) {
      inspectMenu.push({
        text: t('panel.header-menu.query', `Query`),
        onClick: (e: React.MouseEvent<any>) => onInspectPanel(InspectTab.Query),
      });
    }
  }

  inspectMenu.push({
    text: t('panel.header-menu.inspect-json', `Panel JSON`),
    onClick: (e: React.MouseEvent<any>) => onInspectPanel(InspectTab.JSON),
  });

  menu.push({
    type: 'submenu',
    text: t('panel.header-menu.inspect', `Inspect`),
    iconClassName: 'info-circle',
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      const currentTarget = e.currentTarget;
      const target = e.target as HTMLElement;
      const closestMenuItem = target.closest('[role="menuitem"]');

      if (target === currentTarget || closestMenuItem === currentTarget) {
        onInspectPanel();
      }
    },
    shortcut: 'i',
    subMenu: inspectMenu,
  });

  const subMenu: PanelMenuItem[] = [];
  const canEdit = dashboard.canEditPanel(panel);
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
  }

  if (canEdit && panel.plugin && !panel.plugin.meta.skipDataQuery) {
    subMenu.push({
      text: t('panel.header-menu.get-help', 'Get help'),
      onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.Help),
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

  if (!config.featureToggles.newPanelChromeUI) {
    const { extensions } = getPluginExtensions({
      extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
      context: createExtensionContext(panel, dashboard),
    });

    if (extensions.length > 0 && !panel.isEditing) {
      const extensionsMenu: PanelMenuItem[] = [];

      for (const extension of extensions) {
        if (isPluginExtensionLink(extension)) {
          extensionsMenu.push({
            text: truncateTitle(extension.title, 25),
            href: extension.path,
            onClick: extension.onClick,
          });
          continue;
        }
      }

      menu.push({
        text: 'Extensions',
        iconClassName: 'plug',
        type: 'submenu',
        subMenu: extensionsMenu,
      });
    }
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

function truncateTitle(title: string, length: number): string {
  if (title.length < length) {
    return title;
  }
  const part = title.slice(0, length - 3);
  return `${part.trimEnd()}...`;
}

function createExtensionContext(panel: PanelModel, dashboard: DashboardModel): PluginExtensionPanelContext {
  return {
    id: panel.id,
    pluginId: panel.type,
    title: panel.title,
    timeRange: dashboard.time,
    timeZone: dashboard.timezone,
    dashboard: {
      uid: dashboard.uid,
      title: dashboard.title,
      tags: Array.from<string>(dashboard.tags),
    },
    targets: panel.targets,
  };
}
