import React, { PureComponent } from 'react';
import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { PanelHeaderMenuItem } from './PanelHeaderMenuItem';
import { getPanelMenu } from 'app/features/dashboard/utils/getPanelMenu';
import { PanelMenuItem } from 'app/types/panel';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelHeaderMenu extends PureComponent<Props> {
  renderItems = (menu: PanelMenuItem[], isSubMenu = false) => {
    return (
      <ul className="dropdown-menu dropdown-menu--menu panel-menu" role={isSubMenu ? '' : 'menu'}>
        {menu.map((menuItem, idx: number) => {
          return (
            <PanelHeaderMenuItem
              key={`${menuItem.text}${idx}`}
              type={menuItem.type}
              text={menuItem.text}
              iconClassName={menuItem.iconClassName}
              onClick={menuItem.onClick}
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
    const { dashboard, panel } = this.props;
    const menu = getPanelMenu(dashboard, panel);
    return <div className="panel-menu-container dropdown">{this.renderItems(menu)}</div>;
  }
}
