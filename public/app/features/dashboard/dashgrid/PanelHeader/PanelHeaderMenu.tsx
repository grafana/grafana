import React, { PureComponent } from 'react';
import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { PanelHeaderMenuItem } from './PanelHeaderMenuItem';
import { PanelHeaderMenuItemProps } from 'app/types/panel';
import { getPanelMenu } from 'app/features/dashboard/utils/panel_menu';

export interface PanelHeaderMenuProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  additionalMenuItems?: PanelHeaderMenuItemProps[];
  additionalSubMenuItems?: PanelHeaderMenuItemProps[];
}

export class PanelHeaderMenu extends PureComponent<PanelHeaderMenuProps, any> {
  renderItems = (menu: PanelHeaderMenuItemProps[], isSubMenu = false) => {
    return (
      <ul className="dropdown-menu dropdown-menu--menu panel-menu" role={isSubMenu ? '' : 'menu'}>
        {menu.map((menuItem, idx: number) => {
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
    const { dashboard, additionalMenuItems, additionalSubMenuItems, panel } = this.props;
    const menu = getPanelMenu(dashboard, panel, additionalMenuItems, additionalSubMenuItems);
    return <div className="panel-menu-container dropdown">{this.renderItems(menu)}</div>;
  }
}
