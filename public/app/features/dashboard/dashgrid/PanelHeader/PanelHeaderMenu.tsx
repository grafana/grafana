import React, { PureComponent } from 'react';
import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelHeaderMenuItem, PanelHeaderMenuItemProps } from './PanelHeaderMenuItem';
import { getPanelMenu } from 'app/features/dashboard/utils/panel_menu';

export interface PanelHeaderMenuProps {
  panelId: number;
  dashboard: DashboardModel;
  datasource: any;
  additionalMenuItems?: PanelHeaderMenuItemProps[];
  additionalSubMenuItems?: PanelHeaderMenuItemProps[];
}

export class PanelHeaderMenu extends PureComponent<PanelHeaderMenuProps, any> {
  getPanel = () => {
    // Pass in panel as prop instead?
    const { panelId, dashboard } = this.props;
    const panelInfo = dashboard.getPanelInfoById(panelId);
    return panelInfo.panel;
  };

  renderItems = (menu: PanelHeaderMenuItemProps[], isSubMenu = false) => {
    return (
      <ul className="dropdown-menu dropdown-menu--menu panel-menu" role={isSubMenu ? '' : 'menu'}>
        {menu.map((menuItem, idx) => {
          return (
            <PanelHeaderMenuItem
              key={idx} // TODO: Fix proper key
              type={menuItem.type}
              text={menuItem.text}
              iconClassName={menuItem.iconClassName}
              handleClick={menuItem.handleClick}
              shortcut={menuItem.shortcut}
            >
              {menuItem.subMenu && this.renderItems(menuItem.subMenu, true)}
            </PanelHeaderMenuItem>
          );
        })}
      </ul>
    );
  };

  render() {
    console.log('PanelHeaderMenu render');
    const { dashboard, additionalMenuItems, additionalSubMenuItems } = this.props;
    const menu = getPanelMenu(dashboard, this.getPanel(), additionalMenuItems, additionalSubMenuItems);
    return <div className="panel-menu-container dropdown">{this.renderItems(menu)}</div>;
  }
}
