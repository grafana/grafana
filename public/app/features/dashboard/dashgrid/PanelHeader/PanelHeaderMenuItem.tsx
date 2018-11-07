import React, { SFC } from 'react';
import { PanelMenuItem } from 'app/types/panel';

interface Props {
  children: any;
}

export const PanelHeaderMenuItem: SFC<Props & PanelMenuItem> = props => {
  const isSubMenu = props.type === 'submenu';
  const isDivider = props.type === 'divider';
  return isDivider ? (
    <li className="divider" />
  ) : (
    <li className={isSubMenu ? 'dropdown-submenu' : null}>
      <a onClick={props.onClick}>
        {props.iconClassName && <i className={props.iconClassName} />}
        <span className="dropdown-item-text">{props.text}</span>
        {props.shortcut && <span className="dropdown-menu-item-shortcut">{props.shortcut}</span>}
      </a>
      {props.children}
    </li>
  );
};
