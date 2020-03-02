import { updateLocation } from 'app/core/actions';
import { store } from 'app/store/store';
import config from 'app/core/config';
import { getDataSourceSrv, getLocationSrv, AngularComponent } from '@grafana/runtime';
import { PanelMenuItem } from '@grafana/data';
import { copyPanel, duplicatePanel, editPanelJson, removePanel, sharePanel } from 'app/features/dashboard/utils/panel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { contextSrv } from '../../../core/services/context_srv';
import { navigateToExplore } from '../../explore/state/actions';
import { getExploreUrl } from '../../../core/utils/explore';
import { getTimeSrv } from '../services/TimeSrv';
import { PanelCtrl } from '../../panel/panel_ctrl';

export function getPanelMenu(
  dashboard: DashboardModel,
  panel: PanelModel,
  angularComponent?: AngularComponent
): PanelMenuItem[] {
  const onViewPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    store.dispatch(
      updateLocation({
        query: {
          panelId: panel.id,
          edit: null,
          fullscreen: true,
        },
        partial: true,
      })
    );
  };

  const onEditPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    store.dispatch(
      updateLocation({
        query: {
          panelId: panel.id,
          edit: true,
          fullscreen: true,
        },
        partial: true,
      })
    );
  };

  const onNewEditPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    store.dispatch(
      updateLocation({
        query: {
          editPanel: panel.id,
        },
        partial: true,
      })
    );
  };

  const onSharePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    sharePanel(dashboard, panel);
  };

  const onInspectPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    getLocationSrv().update({
      partial: true,
      query: {
        inspect: panel.id,
      },
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

  const onEditPanelJson = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    editPanelJson(dashboard, panel);
  };

  const onRemovePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    removePanel(dashboard, panel, true);
  };

  const onNavigateToExplore = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    const openInNewWindow = event.ctrlKey || event.metaKey ? (url: string) => window.open(url) : undefined;
    store.dispatch(navigateToExplore(panel, { getDataSourceSrv, getTimeSrv, getExploreUrl, openInNewWindow }) as any);
  };

  const menu: PanelMenuItem[] = [];

  menu.push({
    text: 'View',
    iconClassName: 'gicon gicon-viewer',
    onClick: onViewPanel,
    shortcut: 'v',
  });

  if (dashboard.canEditPanel(panel)) {
    menu.push({
      text: 'Edit',
      iconClassName: 'gicon gicon-editor',
      onClick: onEditPanel,
      shortcut: 'e',
    });
  }

  menu.push({
    text: 'Share',
    iconClassName: 'fa fa-fw fa-share',
    onClick: onSharePanel,
    shortcut: 'p s',
  });

  if (contextSrv.hasAccessToExplore() && !panel.plugin.meta.skipDataQuery) {
    menu.push({
      text: 'Explore',
      iconClassName: 'gicon gicon-explore',
      shortcut: 'x',
      onClick: onNavigateToExplore,
    });
  }

  if (config.featureToggles.inspect) {
    menu.push({
      text: 'Inspect',
      iconClassName: 'fa fa-fw fa-info-circle',
      onClick: onInspectPanel,
      shortcut: 'p i',
    });
  }

  if (config.featureToggles.newEdit) {
    menu.push({
      text: 'New edit',
      iconClassName: 'gicon gicon-editor',
      onClick: onNewEditPanel,
      shortcut: 'p i',
    });
  }

  const subMenu: PanelMenuItem[] = [];

  if (!panel.fullscreen && dashboard.canEditPanel(panel)) {
    subMenu.push({
      text: 'Duplicate',
      onClick: onDuplicatePanel,
      shortcut: 'p d',
    });

    subMenu.push({
      text: 'Copy',
      onClick: onCopyPanel,
    });
  }

  subMenu.push({
    text: 'Panel JSON',
    onClick: onEditPanelJson,
  });

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

  menu.push({
    type: 'submenu',
    text: 'More...',
    iconClassName: 'fa fa-fw fa-cube',
    subMenu: subMenu,
    onClick: onMore,
  });

  if (dashboard.canEditPanel(panel)) {
    menu.push({ type: 'divider' });

    menu.push({
      text: 'Remove',
      iconClassName: 'fa fa-fw fa-trash',
      onClick: onRemovePanel,
      shortcut: 'p r',
    });
  }

  return menu;
}
