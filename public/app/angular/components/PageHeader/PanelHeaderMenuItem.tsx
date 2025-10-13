import { css } from '@emotion/css';
import { useState } from 'react';
import * as React from 'react';

import { PanelMenuItem, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, toIconName, useStyles2 } from '@grafana/ui';

interface Props {
  children?: React.ReactNode;
}

export const PanelHeaderMenuItem = (props: Props & PanelMenuItem) => {
  const [ref, setRef] = useState<HTMLLIElement | null>(null);
  const isSubMenu = props.type === 'submenu';
  const styles = useStyles2(getStyles);
  const icon = props.iconClassName ? toIconName(props.iconClassName) : undefined;

  switch (props.type) {
    case 'divider':
      return <li className="divider" />;
    case 'group':
      return (
        <li>
          <span className={styles.groupLabel}>{props.text}</span>
        </li>
      );
    default:
      return (
        <li
          className={isSubMenu ? `dropdown-submenu ${getDropdownLocationCssClass(ref)}` : undefined}
          ref={setRef}
          data-testid={selectors.components.Panels.Panel.menuItems(props.text)}
        >
          <a onClick={props.onClick} href={props.href} role="menuitem">
            {icon && <Icon name={icon} className={styles.menuIconClassName} />}
            <span
              className="dropdown-item-text"
              data-testid={selectors.components.Panels.Panel.headerItems(props.text)}
            >
              {props.text}
              {isSubMenu && <Icon name="angle-right" className={styles.shortcutIconClassName} />}
            </span>

            {props.shortcut && (
              <span className="dropdown-menu-item-shortcut">
                <Icon name="keyboard" className={styles.menuIconClassName} /> {props.shortcut}
              </span>
            )}
          </a>
          {props.children}
        </li>
      );
  }
};

function getDropdownLocationCssClass(element: HTMLElement | null) {
  if (!element) {
    return 'invisible';
  }

  const wrapperPos = element.parentElement!.getBoundingClientRect();
  const pos = element.getBoundingClientRect();

  if (pos.width === 0) {
    return 'invisible';
  }

  if (wrapperPos.right + pos.width + 10 > window.innerWidth) {
    return 'pull-left';
  } else {
    return 'pull-right';
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    menuIconClassName: css({
      marginRight: theme.spacing(1),
      'a::after': {
        display: 'none',
      },
    }),
    shortcutIconClassName: css({
      position: 'absolute',
      top: '7px',
      right: theme.spacing(0.5),
      color: theme.colors.text.secondary,
    }),
    groupLabel: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
      padding: theme.spacing(0.5, 1),
    }),
  };
}
