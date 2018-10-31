import React, { PureComponent } from 'react';
import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelHeaderMenuItem, PanelHeaderMenuItemProps } from './PanelHeaderMenuItem';
import { getPanelMenu } from 'app/features/dashboard/utils/panel_menu';

export interface PanelHeaderMenuProps {
  panelId: number;
  dashboard: DashboardModel;
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
        {menu.map(menuItem => {
          console.log(this);
          return (
            <PanelHeaderMenuItem
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
    const { dashboard } = this.props;
    const menu = getPanelMenu(dashboard, this.getPanel());
    return <div className="panel-menu-container dropdown">{this.renderItems(menu)}</div>;
  }
}
