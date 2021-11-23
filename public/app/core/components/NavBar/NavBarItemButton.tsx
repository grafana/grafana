import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { useMenuTriggerState } from '@react-stately/menu';

import { useFocusVisible, useFocusWithin, useHover, useKeyboard } from '@react-aria/interactions';
import { useMenuTrigger } from '@react-aria/menu';
import { useButton } from '@react-aria/button';

import { Icon, IconName, Link, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

export function MenuButton(props: any) {
  const theme = useTheme2();

  const { link, isActive, reverseDirection, menuItems, id, ...rest } = props;
  const styles = getStyles(theme, isActive);

  // Create state based on the incoming props
  const state = useMenuTriggerState({ ...rest });

  // Get props for the menu trigger and menu elements
  const ref = React.useRef(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger({}, state, ref);

  // style to the focused menu item
  let { isFocusVisible } = useFocusVisible({ isTextInput: false });

  const { hoverProps, isHovered } = useHover({
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

  const [enableAllItems, setEnableAllItems] = useState(false);

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
    <button
      className={styles.element}
      {...buttonProps}
      {...keyboardProps}
      ref={ref}
      onClick={link?.onClick}
      aria-label={link?.label}
    >
      <span className={styles.icon}>
        {link?.icon && <Icon name={link.icon as IconName} size="xl" />}
        {link?.img && <img src={link.img} alt={`${link.text} logo`} />}
      </span>
    </button>
  );

  if (link?.url) {
    element =
      !link.target && link.url.startsWith('/') ? (
        <Link
          {...buttonProps}
          {...keyboardProps}
          ref={ref}
          href={link.url}
          target={link.target}
          onClick={link?.onClick}
          className={styles.element}
        >
          <span className={styles.icon}>
            {link?.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link?.img && <img src={link.img} alt={`${link.text} logo`} />}
          </span>
        </Link>
      ) : (
        <a href={link.url} target={link.target} onClick={link?.onClick} {...buttonProps} {...keyboardProps} ref={ref}>
          <span className={styles.icon}>
            {link?.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link?.img && <img src={link.img} alt={`${link.text} logo`} />}
          </span>
        </a>
      );
  }
  return (
    <li className={cx(styles.element, 'dropdown')} {...focusWithinProps} {...hoverProps}>
      {element}
      {/*{state.isOpen && (*/}
      {/*  <NavBarDropdown*/}
      {/*    {...rest}*/}
      {/*    items={menuItems}*/}
      {/*    enableAllItems={enableAllItems}*/}
      {/*    domProps={menuProps}*/}
      {/*    autoFocus={state.focusStrategy}*/}
      {/*    onClose={() => state.close()}*/}
      {/*    reverseDirection={reverseDirection}*/}
      {/*  />*/}
      {/*)}*/}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive']) => ({
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
