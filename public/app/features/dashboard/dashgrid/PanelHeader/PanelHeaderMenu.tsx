import classnames from 'classnames';
import React, { PureComponent } from 'react';

import { PanelMenuItem } from '@grafana/data';

import { PanelHeaderMenuItem } from './PanelHeaderMenuItem';

export interface Props {
  items: PanelMenuItem[];
  style?: React.CSSProperties;
  itemsClassName?: string;
  className?: string;
}

export class PanelHeaderMenu extends PureComponent<Props> {
  renderItems = (menu: PanelMenuItem[], isSubMenu = false) => {
    return (
      <ul
        className={classnames('dropdown-menu', 'dropdown-menu--menu', 'panel-menu', this.props.itemsClassName)}
        style={this.props.style}
        role={isSubMenu ? '' : 'menu'}
      >
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
      <div className={classnames('panel-menu-container', 'dropdown', 'open', this.props.className)}>
        {this.renderItems(this.props.items)}
      </div>
    );
  }
}
