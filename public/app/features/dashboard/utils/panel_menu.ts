import { PanelHeaderMenuItemTypes, PanelHeaderMenuItemProps } from './../dashgrid/PanelHeader/PanelHeaderMenuItem';
import { store } from 'app/store/configureStore';
import { updateLocation } from 'app/core/actions';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { removePanel, duplicatePanel, copyPanel, editPanelJson, sharePanel } from 'app/features/dashboard/utils/panel';

export const getPanelMenu = (
  dashboard: DashboardModel,
  panel: PanelModel,
  additionalMenuItems: PanelHeaderMenuItemProps[] = [],
  additionalSubMenuItems: PanelHeaderMenuItemProps[] = []
) => {
  const onViewPanel = () => {
    store.dispatch(
      updateLocation({
        query: {
          panelId: panel.id,
          edit: false,
          fullscreen: true,
        },
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

  const getSubMenu = () => {
    const menu: PanelHeaderMenuItemProps[] = [];

    if (!panel.fullscreen && dashboard.meta.canEdit) {
      menu.push({
        type: PanelHeaderMenuItemTypes.Link,
        text: 'Duplicate',
        handleClick: onDuplicatePanel,
        shortcut: 'p d',
        role: 'Editor',
      });
      menu.push({
        type: PanelHeaderMenuItemTypes.Link,
        text: 'Copy',
        handleClick: onCopyPanel,
        role: 'Editor',
      });
    }

    menu.push({
      type: PanelHeaderMenuItemTypes.Link,
      text: 'Panel JSON',
      handleClick: onEditPanelJson,
    });

    additionalSubMenuItems.forEach(item => {
      menu.push(item);
    });
    return menu;
  };

  const menu: PanelHeaderMenuItemProps[] = [];

  menu.push({
    type: PanelHeaderMenuItemTypes.Link,
    text: 'View',
    iconClassName: 'fa fa-fw fa-eye',
    handleClick: onViewPanel,
    shortcut: 'v',
  });

  if (dashboard.meta.canEdit) {
    menu.push({
      type: PanelHeaderMenuItemTypes.Link,
      text: 'Edit',
      iconClassName: 'fa fa-fw fa-edit',
      handleClick: onEditPanel,
      shortcut: 'e',
      role: 'Editor',
    });
  }

  menu.push({
    type: PanelHeaderMenuItemTypes.Link,
    text: 'Share',
    iconClassName: 'fa fa-fw fa-share',
    handleClick: onSharePanel,
    shortcut: 'p s',
  });

  additionalMenuItems.forEach(item => {
    menu.push(item);
  });

  const subMenu: PanelHeaderMenuItemProps[] = getSubMenu();

  menu.push({
    type: PanelHeaderMenuItemTypes.SubMenu,
    text: 'More...',
    iconClassName: 'fa fa-fw fa-cube',
    handleClick: null,
    subMenu: subMenu,
  });

  if (dashboard.meta.canEdit) {
    menu.push({
      type: PanelHeaderMenuItemTypes.Divider,
      role: 'Editor',
    });
    menu.push({
      type: PanelHeaderMenuItemTypes.Link,
      text: 'Remove',
      iconClassName: 'fa fa-fw fa-trash',
      handleClick: onRemovePanel,
      shortcut: 'p r',
      role: 'Editor',
    });
  }

  // Additional items from sub-class
  // menu.push(...this.getAdditionalMenuItems());
  return menu;
};
