import React, { FC } from 'react';
import { PanelMenuItem } from '@grafana/data';
import { e2e } from '@grafana/e2e';

interface Props {
  children: any;
}

export const PanelHeaderMenuItem: FC<Props & PanelMenuItem> = props => {
  const isSubMenu = props.type === 'submenu';
  const isDivider = props.type === 'divider';
  return isDivider ? (
    <li className="divider" />
  ) : (
    <li className={isSubMenu ? 'dropdown-submenu' : undefined}>
      <a onClick={props.onClick} href={props.href}>
        {props.iconClassName && <i className={props.iconClassName} />}
        <span
          className="dropdown-item-text"
          aria-label={e2e.pages.Dashboard.Panels.Panel.selectors.headerItems(props.text)}
        >
          {props.text}
        </span>
        {props.shortcut && <span className="dropdown-menu-item-shortcut">{props.shortcut}</span>}
      </a>
      {props.children}
    </li>
  );
};
