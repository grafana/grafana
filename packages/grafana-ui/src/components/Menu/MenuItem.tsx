import { css, cx } from '@emotion/css';
import { ReactElement, useCallback, useState, useRef, useImperativeHandle, CSSProperties, AriaRole } from 'react';
import * as React from 'react';

import { GrafanaTheme2, LinkTarget } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { IconName } from '../../types/icon';
import { Icon } from '../Icon/Icon';
import { Stack } from '../Layout/Stack/Stack';

import { SubMenu } from './SubMenu';

/** @internal */
export type MenuItemElement = HTMLAnchorElement & HTMLButtonElement & HTMLDivElement;

/** @internal */
export interface MenuItemProps<T = unknown> {
  /** Label of the menu item */
  label: string;
  /** Description of item */
  description?: string;
  /** Aria label for accessibility support */
  ariaLabel?: string;
  /** Aria checked for accessibility support */
  ariaChecked?: boolean;
  /** Target of the menu item (i.e. new window)  */
  target?: LinkTarget;
  /** Icon of the menu item */
  icon?: IconName;
  /** Role of the menu item */
  role?: AriaRole;
  /** Url of the menu item */
  url?: string;
  /** Handler for the click behaviour */
  onClick?: (event: React.MouseEvent<HTMLElement>, payload?: T) => void;
  /** Custom MenuItem styles*/
  className?: string;
  /** Active */
  active?: boolean;
  /** Disabled */
  disabled?: boolean;
  /** Show in destructive style (error color) */
  destructive?: boolean;
  tabIndex?: number;
  /** List of menu items for the subMenu */
  childItems?: Array<ReactElement<MenuItemProps>>;
  /** Custom style for SubMenu */
  customSubMenuContainerStyles?: CSSProperties;
  /** Shortcut key combination */
  shortcut?: string;
  /** Test id for e2e tests and fullstory*/
  testId?: string;
  /* Optional component that will be shown together with other options. Does not get passed any props. */
  component?: React.ComponentType;
}

/** @internal */
export const MenuItem = React.memo(
  React.forwardRef<MenuItemElement, MenuItemProps>((props, ref) => {
    const {
      url,
      icon,
      label,
      description,
      ariaLabel,
      ariaChecked,
      target,
      onClick,
      className,
      active,
      disabled,
      destructive,
      childItems,
      role,
      tabIndex = -1,
      customSubMenuContainerStyles,
      shortcut,
      testId,
    } = props;
    const styles = useStyles2(getStyles);
    const [isActive, setIsActive] = useState(active);
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    const onMouseEnter = useCallback(() => {
      if (disabled) {
        return;
      }

      setIsSubMenuOpen(true);
      setIsActive(true);
    }, [disabled]);
    const onMouseLeave = useCallback(() => {
      if (disabled) {
        return;
      }

      setIsSubMenuOpen(false);
      setIsActive(false);
    }, [disabled]);

    const hasSubMenu = childItems && childItems.length > 0;
    const ItemElement = hasSubMenu ? 'div' : url === undefined ? 'button' : 'a';
    const itemStyle = cx(
      {
        [styles.item]: true,
        [styles.active]: isActive,
        [styles.disabled]: disabled,
        [styles.destructive]: destructive && !disabled,
      },
      className
    );

    const disabledProps = {
      [ItemElement === 'button' ? 'disabled' : 'aria-disabled']: disabled,
      ...(ItemElement === 'a' && disabled && { href: undefined, onClick: undefined }),
      ...(disabled && {
        tabIndex: -1,
        ['data-disabled']: disabled, // used to identify disabled items in Menu.tsx
      }),
    };

    const localRef = useRef<MenuItemElement>(null);
    useImperativeHandle(ref, () => localRef.current!);

    const handleKeys = (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          event.stopPropagation();
          if (hasSubMenu) {
            setIsSubMenuOpen(true);
            setIsActive(true);
          }
          break;
        default:
          break;
      }
    };

    const closeSubMenu = () => {
      setIsSubMenuOpen(false);
      setIsActive(false);
      localRef?.current?.focus();
    };

    const hasShortcut = Boolean(shortcut && shortcut.length > 0);

    return (
      <ItemElement
        target={target}
        className={itemStyle}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        href={url}
        onClick={(event) => {
          if (hasSubMenu && !isSubMenuOpen) {
            event.preventDefault();
            event.stopPropagation();
          }
          onClick?.(event);
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyDown={handleKeys}
        // If there's no URL, then set either the role from the props, or fallback to menuitem
        // If there IS a URL, then use the role from props - which will result in this either being a
        // link (default role of an anchor), or whatever the user of this component specified
        role={!url ? role || 'menuitem' : role}
        data-role="menuitem" // used to identify menuitem in Menu.tsx
        ref={localRef}
        data-testid={testId}
        aria-label={ariaLabel}
        aria-checked={ariaChecked}
        tabIndex={tabIndex}
        {...disabledProps}
      >
        <Stack direction="row" justifyContent="flex-start" alignItems="center">
          {icon && <Icon name={icon} className={styles.icon} aria-hidden />}
          <span className={styles.ellipsis}>{label}</span>
          <div className={cx(styles.rightWrapper, { [styles.withShortcut]: hasShortcut })}>
            {hasShortcut && (
              <div className={styles.shortcut}>
                <Icon name="keyboard" title={t('grafana-ui.menu-item.keyboard-shortcut-label', 'Keyboard shortcut')} />
                {shortcut}
              </div>
            )}
            {hasSubMenu && (
              <SubMenu
                items={childItems}
                isOpen={isSubMenuOpen}
                close={closeSubMenu}
                customStyle={customSubMenuContainerStyles}
              />
            )}
          </div>
        </Stack>
        {description && (
          <div
            className={cx(styles.description, styles.ellipsis, {
              [styles.descriptionWithIcon]: icon !== undefined,
            })}
          >
            {description}
          </div>
        )}
        {props.component ? <props.component /> : null}
      </ItemElement>
    );
  })
);

MenuItem.displayName = 'MenuItem';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    item: css({
      background: 'none',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      color: theme.colors.text.primary,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'center',
      padding: theme.spacing(0.5, 1.5),
      minHeight: theme.spacing(4),
      borderRadius: theme.shape.radius.default,
      margin: 0,
      border: 'none',
      width: '100%',
      position: 'relative',

      '&:hover, &:focus-visible': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
        textDecoration: 'none',
      },

      '&:focus-visible': getFocusStyles(theme),
    }),
    active: css({
      background: theme.colors.action.hover,
    }),
    destructive: css({
      color: theme.colors.error.text,

      svg: {
        color: theme.colors.error.text,
      },

      '&:hover, &:focus, &:focus-visible': {
        background: theme.colors.error.main,
        color: theme.colors.error.contrastText,

        svg: {
          color: theme.colors.error.contrastText,
        },
      },
    }),
    disabled: css({
      color: theme.colors.action.disabledText,
      label: 'menu-item-disabled',
      '&:hover, &:focus, &:focus-visible': {
        cursor: 'not-allowed',
        background: 'none',
        color: theme.colors.action.disabledText,
      },
    }),
    icon: css({
      opacity: 0.7,
      color: theme.colors.text.secondary,
    }),
    rightWrapper: css({
      display: 'flex',
      alignItems: 'center',
      marginLeft: 'auto',
    }),
    withShortcut: css({
      minWidth: theme.spacing(10.5),
    }),
    shortcut: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginLeft: theme.spacing(2),
      color: theme.colors.text.secondary,
    }),
    description: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
      textAlign: 'start',
    }),
    descriptionWithIcon: css({
      marginLeft: theme.spacing(3),
    }),
    ellipsis: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
};
