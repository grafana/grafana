import { t } from '@lingui/macro';

import { PanelMenuItem } from '@grafana/data';
import { AngularComponent, getDataSourceSrv, locationService } from '@grafana/runtime';
import { PanelCtrl } from 'app/angular/panel/panel_ctrl';
import config from 'app/core/config';
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
  };

  const onEditPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    locationService.partial({
      editPanel: panel.id,
    });
  };

  const onSharePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    sharePanel(dashboard, panel);
  };

  const onAddLibraryPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    addLibraryPanel(dashboard, panel);
  };

  const onUnlinkLibraryPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    unlinkLibraryPanel(panel);
  };

  const onInspectPanel = (tab?: InspectTab) => {
    locationService.partial({
      inspect: panel.id,
      inspectTab: tab,
    });
  };

  const onMore = (event: React.MouseEvent<any>) => {
    event.preventDefault();
  };

  const onDuplicatePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    duplicatePanel(dashboard, panel);
  };

  const onCopyPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    copyPanel(panel);
  };

  const onRemovePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    removePanel(dashboard, panel, true);
  };

  const onNavigateToExplore = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    const openInNewWindow =
      event.ctrlKey || event.metaKey ? (url: string) => window.open(`${config.appSubUrl}${url}`) : undefined;
    store.dispatch(navigateToExplore(panel, { getDataSourceSrv, getTimeSrv, getExploreUrl, openInNewWindow }) as any);
  };

  const onToggleLegend = (event: React.MouseEvent) => {
    event.preventDefault();
    toggleLegend(panel);
  };
  const menu: PanelMenuItem[] = [];

  if (!panel.isEditing) {
    const viewTextTranslation = t({
      id: 'panel.header-menu.view',
      message: `View`,
    });
    menu.push({
      text: viewTextTranslation,
      iconClassName: 'eye',
      onClick: onViewPanel,
      shortcut: 'v',
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing) {
    menu.push({
      text: 'Edit',
      iconClassName: 'edit',
      onClick: onEditPanel,
      shortcut: 'e',
    });
  }

  const shareTextTranslation = t({
    id: 'panel.header-menu.share',
    message: `Share`,
  });

  menu.push({
    text: shareTextTranslation,
    iconClassName: 'share-alt',
    onClick: onSharePanel,
    shortcut: 'p s',
  });

  if (contextSrv.hasAccessToExplore() && !(panel.plugin && panel.plugin.meta.skipDataQuery)) {
    menu.push({
      text: 'Explore',
      iconClassName: 'compass',
      onClick: onNavigateToExplore,
      shortcut: 'x',
    });
  }

  const inspectMenu: PanelMenuItem[] = [];

  // Only show these inspect actions for data plugins
  if (panel.plugin && !panel.plugin.meta.skipDataQuery) {
    const dataTextTranslation = t({
      id: 'panel.header-menu.inspect-data',
      message: `Data`,
    });

    inspectMenu.push({
      text: dataTextTranslation,
      onClick: (e: React.MouseEvent<any>) => onInspectPanel(InspectTab.Data),
    });

    if (dashboard.meta.canEdit) {
      inspectMenu.push({
        text: 'Query',
        onClick: (e: React.MouseEvent<any>) => onInspectPanel(InspectTab.Query),
      });
    }
  }

  const jsonTextTranslation = t({
    id: 'panel.header-menu.inspect-json',
    message: `Panel JSON`,
  });

  inspectMenu.push({
    text: jsonTextTranslation,
    onClick: (e: React.MouseEvent<any>) => onInspectPanel(InspectTab.JSON),
  });

  // Only show for editors
  if (panel.plugin && dashboard.meta.canEdit && !panel.plugin.meta.skipDataQuery) {
    inspectMenu.push({
      text: 'Support snapshot',
      onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.Support),
    });
  }

  const inspectTextTranslation = t({
    id: 'panel.header-menu.inspect',
    message: `Inspect`,
  });

  menu.push({
    type: 'submenu',
    text: inspectTextTranslation,
    iconClassName: 'info-circle',
    onClick: (e: React.MouseEvent<any>) => onInspectPanel(),
    shortcut: 'i',
    subMenu: inspectMenu,
  });

  const subMenu: PanelMenuItem[] = [];

  if (dashboard.canEditPanel(panel) && !(panel.isViewing || panel.isEditing)) {
    subMenu.push({
      text: 'Duplicate',
      onClick: onDuplicatePanel,
      shortcut: 'p d',
    });

    subMenu.push({
      text: 'Copy',
      onClick: onCopyPanel,
    });

    if (isPanelModelLibraryPanel(panel)) {
      subMenu.push({
        text: 'Unlink library panel',
        onClick: onUnlinkLibraryPanel,
      });
    } else {
      subMenu.push({
        text: 'Create library panel',
        onClick: onAddLibraryPanel,
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
      text: panel.options.legend.showLegend ? 'Hide legend' : 'Show legend',
      onClick: onToggleLegend,
      shortcut: 'p l',
    });
  }

  if (!panel.isEditing && subMenu.length) {
    const moreTextTranslation = t({
      id: 'panel.header-menu.more',
      message: `More...`,
    });
    menu.push({
      type: 'submenu',
      text: moreTextTranslation,
      iconClassName: 'cube',
      subMenu,
      onClick: onMore,
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing && !panel.isViewing) {
    menu.push({ type: 'divider', text: '' });

    menu.push({
      text: 'Remove',
      iconClassName: 'trash-alt',
      onClick: onRemovePanel,
      shortcut: 'p r',
    });
  }

  return menu;
}
