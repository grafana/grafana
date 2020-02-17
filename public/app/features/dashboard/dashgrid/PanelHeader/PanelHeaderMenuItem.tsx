import React, { FC } from 'react';
import { PanelMenuItem } from '@grafana/data';
import { e2e } from '@grafana/e2e';
import { Link } from 'react-router-dom';

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
      <Link onClick={props.onClick} to={props.href}>
        {props.iconClassName && <i className={props.iconClassName} />}
        <span
          className="dropdown-item-text"
          aria-label={e2e.pages.Dashboard.Panels.Panel.selectors.headerItems(props.text)}
        >
          {props.text}
        </span>
        {props.shortcut && <span className="dropdown-menu-item-shortcut">{props.shortcut}</span>}
      </Link>
      {props.children}
    </li>
  );
};
