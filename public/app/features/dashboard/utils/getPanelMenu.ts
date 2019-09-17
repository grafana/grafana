import { updateLocation } from 'app/core/actions';
import { store } from 'app/store/store';

import { removePanel, duplicatePanel, copyPanel, editPanelJson, sharePanel } from 'app/features/dashboard/utils/panel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelMenuItem } from '@grafana/ui';

export const getPanelMenu = (dashboard: DashboardModel, panel: PanelModel) => {
  const onViewPanel = () => {
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

  const onEditPanel = () => {
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

  const onSharePanel = () => {
    sharePanel(dashboard, panel);
  };

  const onDuplicatePanel = () => {
    duplicatePanel(dashboard, panel);
  };

  const onCopyPanel = () => {
    copyPanel(panel);
  };

  const onEditPanelJson = () => {
    editPanelJson(dashboard, panel);
  };

  const onRemovePanel = () => {
    removePanel(dashboard, panel, true);
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
