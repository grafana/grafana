import React, { FC } from 'react';
import { css } from 'emotion';
import { PanelMenuItem } from '@grafana/data';
import { Icon, IconName, useTheme } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  children: any;
}

export const PanelHeaderMenuItem: FC<Props & PanelMenuItem> = props => {
  const isSubMenu = props.type === 'submenu';
  const isDivider = props.type === 'divider';
  const theme = useTheme();
  const menuIconClassName = css`
    margin-right: ${theme.spacing.sm};
    a::after {
      display: none;
    }
  `;
  const shortcutIconClassName = css`
    position: absolute;
    top: 7px;
    right: ${theme.spacing.xs};
    color: ${theme.colors.textWeak};
  `;
  return isDivider ? (
    <li className="divider" />
  ) : (
    <li className={isSubMenu ? 'dropdown-submenu' : undefined}>
      <a onClick={props.onClick} href={props.href}>
        {props.iconClassName && <Icon name={props.iconClassName as IconName} className={menuIconClassName} />}
        <span className="dropdown-item-text" aria-label={selectors.components.Panels.Panel.headerItems(props.text)}>
          {props.text}
          {isSubMenu && <Icon name="angle-right" className={shortcutIconClassName} />}
        </span>
        {props.shortcut && (
          <span className="dropdown-menu-item-shortcut">
            <Icon name="keyboard" className={menuIconClassName} /> {props.shortcut}
          </span>
        )}
      </a>
      {props.children}
    </li>
  );
};
