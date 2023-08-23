import classnames from 'classnames';
import React, { PureComponent } from 'react';

import { PanelMenuItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';

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
              href={menuItem.href}
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
        {this.renderItems(flattenGroups(this.props.items))}
      </div>
    );
  }
}

function flattenGroups(items: PanelMenuItem[]): PanelMenuItem[] {
  return items.reduce((all: PanelMenuItem[], item) => {
    if (Array.isArray(item.subMenu) && item.type === 'submenu') {
      all.push({
        ...item,
        subMenu: flattenGroups(item.subMenu),
      });
      return all;
    }

    if (Array.isArray(item.subMenu) && item.type === 'group') {
      const { subMenu, ...rest } = item;
      all.push(rest);
      all.push.apply(all, flattenGroups(subMenu));
      return all;
    }

    all.push(item);
    return all;
  }, []);
}

export function PanelHeaderMenuNew({ items }: Props) {
  const renderItems = (items: PanelMenuItem[]) => {
    return items.map((item) => {
      switch (item.type) {
        case 'divider':
          return <Menu.Divider key={item.text} />;
        case 'group':
          return (
            <Menu.Group key={item.text} label={item.text}>
              {item.subMenu ? renderItems(item.subMenu) : undefined}
            </Menu.Group>
          );
        default:
          return (
            <Menu.Item
              key={item.text}
              label={item.text}
              icon={item.iconClassName}
              childItems={item.subMenu ? renderItems(item.subMenu) : undefined}
              url={item.href}
              onClick={item.onClick}
              shortcut={item.shortcut}
              testId={selectors.components.Panels.Panel.menuItems(item.text)}
            />
          );
      }
    });
  };

  return <Menu>{renderItems(items)}</Menu>;
}
