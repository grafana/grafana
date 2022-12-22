import { css, cx } from '@emotion/css';
import { useButton } from '@react-aria/button';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useFocusWithin, useHover, useKeyboard } from '@react-aria/interactions';
import { useMenuTrigger } from '@react-aria/menu';
import { DismissButton, OverlayContainer, useOverlay, useOverlayPosition } from '@react-aria/overlays';
import { useMenuTriggerState } from '@react-stately/menu';
import { MenuTriggerProps } from '@react-types/menu';
import React, { ReactElement, useEffect, useState } from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { reportExperimentView } from '@grafana/runtime';
import { Link, useTheme2 } from '@grafana/ui';

import { NavBarItemIcon } from './NavBarItemIcon';
import { getNavMenuPortalContainer } from './NavBarMenuPortalContainer';
import { NavFeatureHighlight } from './NavFeatureHighlight';
import { NavBarItemMenuContext, useNavBarContext } from './context';

export interface NavBarItemMenuTriggerProps extends MenuTriggerProps {
  children: ReactElement;
  item: NavModelItem;
  isActive?: boolean;
  label: string;
  reverseMenuDirection: boolean;
}

export function NavBarItemMenuTrigger(props: NavBarItemMenuTriggerProps): ReactElement {
  const { item, isActive, label, children: menu, reverseMenuDirection, ...rest } = props;
  const [menuHasFocus, setMenuHasFocus] = useState(false);
  const { menuIdOpen, setMenuIdOpen } = useNavBarContext();
  const theme = useTheme2();
  const styles = getStyles(theme, isActive);

  // Create state based on the incoming props
  const state = useMenuTriggerState({ ...rest });

  // Get props for the menu trigger and menu elements
  const ref = React.useRef<HTMLElement>(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger({}, state, ref);

  useEffect(() => {
    if (item.highlightId) {
      reportExperimentView(`feature-highlights-${item.highlightId}-nav`, 'test', '');
    }
  }, [item.highlightId]);

  const { hoverProps } = useHover({
    onHoverChange: (isHovering) => {
      if (isHovering) {
        state.open();
        setMenuIdOpen(item.id);
      } else {
        state.close();
        setMenuIdOpen(undefined);
      }
    },
  });

  useEffect(() => {
    // close the menu when changing submenus
    if (menuIdOpen !== item.id) {
      state.close();
      setMenuHasFocus(false);
    } else {
      state.open();
    }
  }, [menuIdOpen, state, item.id]);

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      switch (e.key) {
        case 'ArrowRight':
          if (!state.isOpen) {
            state.open();
            setMenuIdOpen(item.id);
          }
          setMenuHasFocus(true);
          break;
        case 'Tab':
          setMenuIdOpen(undefined);
          break;
        default:
          break;
      }
    },
  });

  // Get props for the button based on the trigger props from useMenuTrigger
  const { buttonProps } = useButton(menuTriggerProps, ref);
  const Wrapper = item.highlightText ? NavFeatureHighlight : React.Fragment;
  const itemContent = (
    <Wrapper>
      <span className={styles.icon}>
        <NavBarItemIcon link={item} />
      </span>
    </Wrapper>
  );
  let element = (
    <button
      className={styles.element}
      {...buttonProps}
      {...keyboardProps}
      {...hoverProps}
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={item?.onClick}
      aria-label={label}
    >
      {itemContent}
    </button>
  );

  if (item?.url) {
    element =
      !item.target && item.url.startsWith('/') ? (
        <Link
          {...buttonProps}
          {...keyboardProps}
          {...hoverProps}
          ref={ref as React.RefObject<HTMLAnchorElement>}
          href={item.url}
          target={item.target}
          onClick={item?.onClick}
          className={styles.element}
          aria-label={label}
        >
          {itemContent}
        </Link>
      ) : (
        <a
          href={item.url}
          target={item.target}
          onClick={item?.onClick}
          {...buttonProps}
          {...keyboardProps}
          {...hoverProps}
          ref={ref as React.RefObject<HTMLAnchorElement>}
          className={styles.element}
          aria-label={label}
        >
          {itemContent}
        </a>
      );
  }

  const overlayRef = React.useRef<HTMLDivElement>(null);
  const { dialogProps } = useDialog({}, overlayRef);
  const { overlayProps } = useOverlay(
    {
      onClose: () => {
        state.close();
        setMenuIdOpen(undefined);
      },
      isOpen: state.isOpen,
      isDismissable: true,
    },
    overlayRef
  );

  let { overlayProps: overlayPositionProps } = useOverlayPosition({
    targetRef: ref,
    overlayRef,
    placement: reverseMenuDirection ? 'right bottom' : 'right top',
    isOpen: state.isOpen,
  });

  const { focusWithinProps } = useFocusWithin({
    onFocusWithin: (e) => {
      if (e.target.id === ref.current?.id) {
        // If focussing on the trigger itself, set the menu id that is open
        setMenuIdOpen(item.id);
        state.open();
      }
      e.target.scrollIntoView?.({
        block: 'nearest',
      });
    },
    onBlurWithin: (e) => {
      if (e.target?.getAttribute('role') === 'menuitem' && !overlayRef.current?.contains(e.relatedTarget)) {
        // If it is blurring from a menuitem to an element outside the current overlay
        // close the menu that is open
        setMenuIdOpen(undefined);
      }
    },
  });

  return (
    <div className={cx(styles.element, 'dropdown')} {...focusWithinProps}>
      {element}
      {state.isOpen && (
        <OverlayContainer portalContainer={getNavMenuPortalContainer()}>
          <NavBarItemMenuContext.Provider
            value={{
              menuProps,
              menuHasFocus,
              onClose: () => state.close(),
              onLeft: () => {
                setMenuHasFocus(false);
                ref.current?.focus();
              },
            }}
          >
            <FocusScope restoreFocus>
              <div {...overlayProps} {...overlayPositionProps} {...dialogProps} {...hoverProps} ref={overlayRef}>
                <DismissButton onDismiss={() => state.close()} />
                {menu}
                <DismissButton onDismiss={() => state.close()} />
              </div>
            </FocusScope>
          </NavBarItemMenuContext.Provider>
        </OverlayContainer>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, isActive?: boolean) => ({
  element: css({
    backgroundColor: 'transparent',
    border: 'none',
    color: 'inherit',
    display: 'grid',
    padding: 0,
    placeContent: 'center',
    height: theme.spacing(6),
    width: theme.spacing(7),

    '&::before': {
      display: isActive ? 'block' : 'none',
      content: '" "',
      position: 'absolute',
      left: theme.spacing(1),
      top: theme.spacing(1.5),
      bottom: theme.spacing(1.5),
      width: theme.spacing(0.5),
      borderRadius: theme.shape.borderRadius(1),
      backgroundImage: theme.colors.gradients.brandVertical,
    },

    '&:focus-visible': {
      backgroundColor: theme.colors.action.hover,
      boxShadow: 'none',
      color: theme.colors.text.primary,
      outline: `${theme.shape.borderRadius(1)} solid ${theme.colors.primary.main}`,
      outlineOffset: `-${theme.shape.borderRadius(1)}`,
      transition: 'none',
    },
  }),
  icon: css({
    height: '100%',
    width: '100%',
  }),
});
