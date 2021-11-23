import React, {
  createContext,
  HTMLAttributes,
  Key,
  ReactElement,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { css, cx } from '@emotion/css';
import { Icon, IconName, Link, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { MenuTriggerProps, SpectrumMenuProps } from '@react-types/menu';
import { useMenuTriggerState } from '@react-stately/menu';
import { useMenu, useMenuItem, useMenuTrigger } from '@react-aria/menu';
import { useFocus, useFocusVisible, useFocusWithin, useHover, useKeyboard } from '@react-aria/interactions';
import { useButton } from '@react-aria/button';
import { TreeState, useTreeState } from '@react-stately/tree';
import { DismissButton, useOverlay } from '@react-aria/overlays';
import { FocusScope } from '@react-aria/focus';
import { mergeProps } from '@react-aria/utils';
import { Node } from '@react-types/shared';

export interface NavBarItemMenuTriggerProps extends MenuTriggerProps {
  children: ReactElement;
  item: NavModelItem;
  isActive?: boolean;
}

export function NavBarItemMenuTrigger(props: NavBarItemMenuTriggerProps): ReactElement {
  const { item, isActive, children: menu, ...rest } = props;
  const [enableAllItems, setEnableAllItems] = useState(false);
  const theme = useTheme2();
  const styles = getStyles(theme, isActive);

  // Create state based on the incoming props
  const state = useMenuTriggerState({ ...rest });

  // Get props for the menu trigger and menu elements
  const ref = React.useRef(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger({}, state, ref);

  // style to the focused menu item
  let { isFocusVisible } = useFocusVisible({ isTextInput: false });

  const { hoverProps } = useHover({
    onHoverChange: (isHovering) => {
      console.log({ stateHover: state.isOpen });
      if (isHovering) {
        state.open();
      }
      if (!isHovering) {
        state.close();
      }
    },
  });

  const { focusWithinProps } = useFocusWithin({
    onFocusWithinChange: (isFocused) => {
      if (isFocused && isFocusVisible) {
        state.open();
      }
      if (!isFocused) {
        state.close();
        setEnableAllItems(false);
      }
    },
  });

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      switch (e.key) {
        case 'ArrowRight':
          if (!state.isOpen) {
            state.open();
          }
          setEnableAllItems(true);
          break;
        default:
          break;
      }
    },
  });

  // Get props for the button based on the trigger props from useMenuTrigger
  const { buttonProps } = useButton(menuTriggerProps, ref);

  let element = (
    <button className={styles.element} {...buttonProps} {...keyboardProps} ref={ref} onClick={item?.onClick}>
      <span className={styles.icon}>
        {item?.icon && <Icon name={item.icon as IconName} size="xl" />}
        {item?.img && <img src={item.img} alt={`${item.text} logo`} />}
      </span>
    </button>
  );

  if (item?.url) {
    element =
      !item.target && item.url.startsWith('/') ? (
        <Link
          {...buttonProps}
          {...keyboardProps}
          ref={ref}
          href={item.url}
          target={item.target}
          onClick={item?.onClick}
          className={styles.element}
        >
          <span className={styles.icon}>
            {item?.icon && <Icon name={item.icon as IconName} size="xl" />}
            {item?.img && <img src={item.img} alt={`${item.text} logo`} />}
          </span>
        </Link>
      ) : (
        <a href={item.url} target={item.target} onClick={item?.onClick} {...buttonProps} {...keyboardProps} ref={ref}>
          <span className={styles.icon}>
            {item?.icon && <Icon name={item.icon as IconName} size="xl" />}
            {item?.img && <img src={item.img} alt={`${item.text} logo`} />}
          </span>
        </a>
      );
  }

  const overlayRef = React.useRef(null);
  const { overlayProps } = useOverlay(
    {
      onClose: () => state.close(),
      shouldCloseOnBlur: true,
      isOpen: state.isOpen,
      isDismissable: true,
    },
    overlayRef
  );

  return (
    <li className={cx(styles.element, 'dropdown')} {...focusWithinProps} {...hoverProps}>
      {element}
      {state.isOpen && (
        <NavBarItemMenuContext.Provider value={{ menuProps, enableAllItems, onClose: () => state.close() }}>
          <FocusScope restoreFocus>
            <div {...overlayProps} ref={overlayRef}>
              <DismissButton onDismiss={() => state.close()} />
              {menu}
              <DismissButton onDismiss={() => state.close()} />
            </div>
          </FocusScope>
        </NavBarItemMenuContext.Provider>
      )}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2, isActive?: boolean) => ({
  container: css`
    position: relative;
    color: ${isActive ? theme.colors.text.primary : theme.colors.text.secondary};
    list-style: none;

    &:hover {
      background-color: ${theme.colors.action.hover};
      color: ${theme.colors.text.primary};

      // TODO don't use a hardcoded class here, use isVisible in NavBarDropdown
      .navbar-dropdown {
        opacity: 1;
        visibility: visible;
      }
    }
  `,
  element: css`
    background-color: transparent;
    border: none;
    color: inherit;
    display: block;
    line-height: ${theme.components.sidemenu.width}px;
    padding: 0;
    text-align: center;
    width: ${theme.components.sidemenu.width}px;

    &::before {
      display: ${isActive ? 'block' : 'none'};
      content: ' ';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      border-radius: 2px;
      background-image: ${theme.colors.gradients.brandVertical};
    }

    &:focus-visible {
      background-color: ${theme.colors.action.hover};
      box-shadow: none;
      color: ${theme.colors.text.primary};
      outline: 2px solid ${theme.colors.primary.main};
      outline-offset: -2px;
      transition: none;
    }
  `,
  icon: css`
    height: 100%;
    width: 100%;

    img {
      border-radius: 50%;
      height: ${theme.spacing(3)};
      width: ${theme.spacing(3)};
    }
  `,
});

export interface NavBarItemMenuContextProps {
  enableAllItems: boolean;
  onClose: () => void;
  menuProps?: HTMLAttributes<HTMLElement>;
}

export const NavBarItemMenuContext = createContext<NavBarItemMenuContextProps>({
  enableAllItems: false,
  onClose: () => undefined,
});

export function useNavBarItemMenuContext(): NavBarItemMenuContextProps {
  return useContext(NavBarItemMenuContext);
}

export interface NavBarItemMenuProps extends SpectrumMenuProps<NavModelItem> {
  adjustHeightForBorder: boolean;
  reverseMenuDirection?: boolean;
}

export function NavBarItemMenu(props: NavBarItemMenuProps): ReactElement {
  const { reverseMenuDirection, adjustHeightForBorder, disabledKeys, ...rest } = props;
  const contextProps = useNavBarItemMenuContext();
  const completeProps = {
    ...mergeProps(contextProps, rest),
  };
  const { enableAllItems, menuProps: contextMenuProps = {} } = contextProps;
  const theme = useTheme2();
  const styles = getNavBarItemMenuStyles(theme, adjustHeightForBorder, reverseMenuDirection);
  const state = useTreeState<NavModelItem>({ ...rest, disabledKeys });
  const section = [...state.collection].filter((item) => item.type === 'section')[0];
  const ref = useRef(null);
  const { menuProps } = useMenu(completeProps, { ...state }, ref);

  return (
    <ul
      className={`${styles.menu} navbar-dropdown`}
      ref={ref}
      {...mergeProps(menuProps, contextMenuProps)}
      tabIndex={enableAllItems ? 0 : -1}
    >
      <NavBarItemMenuSection
        item={section}
        reverseDirection={reverseMenuDirection}
        state={state}
        onAction={props.onAction}
      />
    </ul>
  );
}

function getNavBarItemMenuStyles(
  theme: GrafanaTheme2,
  adjustHeightForBorder: boolean,
  reverseDirection?: boolean,
  isFocused?: boolean
) {
  return {
    menu: css`
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.components.panel.borderColor};
      bottom: ${reverseDirection ? 0 : 'auto'};
      box-shadow: ${theme.shadows.z3};
      display: flex;
      flex-direction: column;
      left: 100%;
      list-style: none;
      min-width: 140px;
      position: absolute;
      top: ${reverseDirection ? 'auto' : 0};
      transition: ${theme.transitions.create('opacity')};
      z-index: ${theme.zIndex.sidemenu};
      list-style: none;
    `,
    header: css`
      background-color: ${theme.colors.background.secondary};
      color: ${theme.colors.text.primary};
      height: ${theme.components.sidemenu.width - (adjustHeightForBorder ? 2 : 1)}px;
      font-size: ${theme.typography.h4.fontSize};
      font-weight: ${theme.typography.h4.fontWeight};
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      white-space: nowrap;
      width: 100%;
    `,
    menuItem: css`
      background-color: ${isFocused ? theme.colors.action.hover : 'transparent'};
      color: ${isFocused ? 'white' : theme.colors.text.primary};

      &:focus-visible {
        background-color: ${theme.colors.action.hover};
        box-shadow: none;
        color: ${theme.colors.text.primary};
        outline: 2px solid ${theme.colors.primary.main};
        // Need to add condition, header is 0, otherwise -2
        outline-offset: -0px;
        transition: none;
      }
    `,
    subtitle: css`
      border-${reverseDirection ? 'bottom' : 'top'}: 1px solid ${theme.colors.border.weak};
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.bodySmall.fontWeight};
      padding: ${theme.spacing(1)} ${theme.spacing(2)} ${theme.spacing(1)};
      white-space: nowrap;
    `,
  };
}

export interface NavBarItemMenuSectionProps {
  item: Node<NavModelItem>;
  state: TreeState<NavModelItem>;
  reverseDirection?: boolean;
  onAction?: (key: Key) => void;
}

export function NavBarItemMenuSection({
  item,
  state,
  onAction,
  reverseDirection = false,
}: NavBarItemMenuSectionProps): ReactElement {
  const { enableAllItems } = useNavBarItemMenuContext();
  const theme = useTheme2();
  const styles = getNavBarItemMenuStyles(theme, false, reverseDirection);
  const menuSubTitle = item.value.subTitle;
  const items = item.hasChildNodes ? [...item.childNodes] : [];

  useEffect(() => {
    if (enableAllItems && !state.selectionManager.isFocused) {
      state.selectionManager.setFocusedKey(item.key);
      state.selectionManager.setFocused(true);
    } else if (!enableAllItems && state.selectionManager.isFocused) {
      state.selectionManager.setFocused(false);
      state.selectionManager.clearSelection();
    }
  }, [enableAllItems, state.selectionManager, reverseDirection, item.key]);

  const section = (
    <NavBarItemMenuItem
      key={`${item.key}`}
      item={item}
      state={state}
      onAction={onAction}
      reverseDirection={reverseDirection}
    />
  );

  const subTitle = (
    <li key={menuSubTitle} className={styles.menuItem}>
      <div className={styles.subtitle}>{menuSubTitle}</div>
    </li>
  );

  return (
    <>
      {!reverseDirection ? section : null}
      {menuSubTitle && reverseDirection ? subTitle : null}
      {items.map((item, index) => {
        return (
          <NavBarItemMenuItem
            key={`${item.key}-${index}`}
            item={item}
            state={state}
            onAction={onAction}
            reverseDirection={reverseDirection}
          />
        );
      })}
      {reverseDirection ? section : null}
      {menuSubTitle && !reverseDirection ? subTitle : null}
    </>
  );
}

export interface NavBarItemMenuItemProps {
  item: Node<NavModelItem>;
  state: TreeState<NavModelItem>;
  reverseDirection?: boolean;
  onAction?: (key: Key) => void;
}

export function NavBarItemMenuItem({
  item,
  state,
  onAction,
  reverseDirection = false,
}: NavBarItemMenuItemProps): ReactElement {
  const { onClose } = useNavBarItemMenuContext();
  const { key, rendered } = item;
  const ref = useRef<HTMLLIElement>(null);
  const isDisabled = state.disabledKeys.has(key);

  // style to the focused menu item
  const [isFocused, setFocused] = useState(false);
  const { focusProps } = useFocus({ onFocusChange: setFocused, isDisabled });
  const theme = useTheme2();
  const styles = getStylesMenuItem(theme, isFocused, reverseDirection);

  let { menuItemProps } = useMenuItem(
    {
      isDisabled,
      'aria-label': item['aria-label'],
      key,
      onClose,
      closeOnSelect: true,
      onAction,
    },
    state,
    ref
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        // Stop propagation, unless it would already be handled by useKeyboard.
        if (!('continuePropagation' in e)) {
          e.stopPropagation();
        }
        e.preventDefault();
        // Alert: Hacky way to go to link
        e.currentTarget?.querySelector('a')?.click();
        e.currentTarget?.querySelector('button')?.click();
        break;
    }
  };

  return (
    <li {...mergeProps(menuItemProps, focusProps)} onKeyDown={onKeyDown} ref={ref} className={styles.menuItem}>
      {rendered}
    </li>
  );
}

function getStylesMenuItem(theme: GrafanaTheme2, isFocused: boolean, reverseDirection: boolean) {
  return {
    menuItem: css`
      background-color: ${isFocused ? theme.colors.action.hover : 'transparent'};
      color: ${isFocused ? 'white' : theme.colors.text.primary};

      &:focus-visible {
        background-color: ${theme.colors.action.hover};
        box-shadow: none;
        color: ${theme.colors.text.primary};
        outline: 2px solid ${theme.colors.primary.main};
        // Need to add condition, header is 0, otherwise -2
        outline-offset: -0px;
        transition: none;
      }
    `,
  };
}
