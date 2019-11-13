import { updateLocation } from 'app/core/actions';
import { store } from 'app/store/store';
import config from 'app/core/config';
import { getDataSourceSrv, getLocationSrv } from '@grafana/runtime';
import { PanelMenuItem } from '@grafana/data';

import { copyPanel, duplicatePanel, editPanelJson, removePanel, sharePanel } from 'app/features/dashboard/utils/panel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { contextSrv } from '../../../core/services/context_srv';
import { navigateToExplore } from '../../explore/state/actions';
import { getExploreUrl } from '../../../core/utils/explore';
import { getTimeSrv } from '../services/TimeSrv';

export const getPanelMenu = (dashboard: DashboardModel, panel: PanelModel) => {
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
    store.dispatch(navigateToExplore(panel, { getDataSourceSrv, getTimeSrv, getExploreUrl, openInNewWindow }));
  };

  const menu: PanelMenuItem[] = [];

  menu.push({
    text: 'View',
    iconClassName: 'gicon gicon-viewer',
    onClick: onViewPanel,
    shortcut: 'v',
  });

  if (dashboard.meta.canEdit) {
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

  if (contextSrv.hasAccessToExplore() && panel.datasource) {
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

  const subMenu: PanelMenuItem[] = [];

  if (!panel.fullscreen && dashboard.meta.canEdit) {
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

  menu.push({
    type: 'submenu',
    text: 'More...',
    iconClassName: 'fa fa-fw fa-cube',
    subMenu: subMenu,
    onClick: onMore,
  });

  if (dashboard.meta.canEdit) {
    menu.push({ type: 'divider' });

    menu.push({
      text: 'Remove',
      iconClassName: 'fa fa-fw fa-trash',
      onClick: onRemovePanel,
      shortcut: 'p r',
    });
  }

  return menu;
};
