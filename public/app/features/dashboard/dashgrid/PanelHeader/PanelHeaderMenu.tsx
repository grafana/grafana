import React, { PureComponent } from 'react';
import { PanelHeaderMenuItem } from './PanelHeaderMenuItem';
import { PanelMenuItem, CartesianCoords2D, Dimensions2D } from '@grafana/data';
export interface Props {
  items: PanelMenuItem[];
  coordinates?: CartesianCoords2D;
  dimensions?: Dimensions2D;
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
    return (
      <div
        className="panel-menu-container dropdown open"
        style={{
          position: 'fixed',
          top: this.props.coordinates?.y,
          left: this.props.coordinates?.x + this.props.dimensions?.width / 2,
        }}
      >
        {this.renderItems(this.props.items)}
      </div>
    );
  }
}
