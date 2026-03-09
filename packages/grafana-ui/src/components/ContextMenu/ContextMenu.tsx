import { autoUpdate, offset, size, useFloating, useMergeRefs } from '@floating-ui/react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as React from 'react';
import { useClickAway } from 'react-use';

import { selectors } from '@grafana/e2e-selectors';

import { getPositioningMiddleware } from '../../utils/floating';
import { Menu } from '../Menu/Menu';
import { Portal } from '../Portal/Portal';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';

export interface ContextMenuProps {
  /** Starting horizontal position for the menu */
  x: number;
  /** Starting vertical position for the menu */
  y: number;
  /** Callback for closing the menu */
  onClose?: () => void;
  /** On menu open focus the first element */
  focusOnOpen?: boolean;
  /** RenderProp function that returns menu items to display */
  renderMenuItems?: () => React.ReactNode;
  /** A function that returns header element */
  renderHeader?: () => React.ReactNode;
}

/**
 * A menu displaying additional options when it's not possible to show them at all times due to a space constraint.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/overlays-contextmenu--docs
 */
export const ContextMenu = React.memo(
  ({ x, y, onClose, focusOnOpen = true, renderMenuItems, renderHeader }: ContextMenuProps) => {
    const floatingRef = useRef<HTMLDivElement | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const OFFSET = 5;
    const middleware = useMemo(
      () => [
        offset(OFFSET),
        ...getPositioningMiddleware('bottom-start'),
        size({
          padding: OFFSET,
          apply({ availableHeight, elements }) {
            const maxHeight = `${Math.max(0, availableHeight)}px`;
            elements.floating.style.maxHeight = maxHeight;
            elements.floating.style.overflowY = 'auto';
            elements.floating.style.overflowX = 'hidden';
            elements.floating.style.setProperty('--context-menu-max-height', maxHeight);
          },
        }),
      ],
      []
    );

    const { refs, floatingStyles } = useFloating({
      placement: 'bottom-start',
      middleware,
      whileElementsMounted: autoUpdate,
      strategy: 'fixed',
    });

    const virtualReference = useMemo(
      () => ({
        getBoundingClientRect: () => ({
          x,
          y,
          width: 0,
          height: 0,
          top: y,
          right: x,
          bottom: y,
          left: x,
        }),
      }),
      [x, y]
    );

    useLayoutEffect(() => {
      refs.setReference(virtualReference);
    }, [refs, virtualReference]);

    const mergedFloatingRef = useMergeRefs([floatingRef, refs.setFloating]);

    useClickAway(floatingRef, () => {
      onClose?.();
    });
    const header = renderHeader?.();
    const menuItems = renderMenuItems?.();
    const onOpen = (setFocusedItem: (a: number) => void) => {
      if (focusOnOpen) {
        setFocusedItem(0);
      }
    };
    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };

    return (
      <Portal>
        <div
          ref={mergedFloatingRef}
          style={floatingStyles}
        >
          <ScrollContainer
            maxHeight="var(--context-menu-max-height, 100vh)"
            overflowY="auto"
            overflowX="hidden"
          >
            <Menu
              header={header}
              ref={menuRef}
              ariaLabel={selectors.components.Menu.MenuComponent('Context')}
              onOpen={onOpen}
              onClick={onClose}
              onKeyDown={onKeyDown}
            >
              {menuItems}
            </Menu>
          </ScrollContainer>
        </div>
      </Portal>
    );
  }
);

ContextMenu.displayName = 'ContextMenu';
