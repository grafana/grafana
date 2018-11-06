import React, { SFC } from 'react';
import { PanelHeaderMenuItemProps, PanelHeaderMenuItemTypes } from 'app/types/panel';

export const PanelHeaderMenuItem: SFC<PanelHeaderMenuItemProps> = props => {
  const isSubMenu = props.type === PanelHeaderMenuItemTypes.SubMenu;
  const isDivider = props.type === PanelHeaderMenuItemTypes.Divider;
  return isDivider ? (
    <li className="divider" />
  ) : (
    <li className={isSubMenu ? 'dropdown-submenu' : null}>
      <a onClick={props.handleClick}>
        {props.iconClassName && <i className={props.iconClassName} />}
        <span className="dropdown-item-text">{props.text}</span>
        {props.shortcut && <span className="dropdown-menu-item-shortcut">{props.shortcut}</span>}
      </a>
      {props.children}
    </li>
  );
};
