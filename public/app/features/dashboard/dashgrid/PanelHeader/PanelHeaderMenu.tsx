import React, { PureComponent } from 'react';
import { PanelHeaderMenuItem } from './PanelHeaderMenuItem';
import { PanelMenuItem } from '@grafana/data';

export interface Props {
  items: PanelMenuItem[];
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
    return <div className="panel-menu-container dropdown open">{this.renderItems(this.props.items)}</div>;
  }
}
