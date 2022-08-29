import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { forwardRef, HTMLAttributes, useState, useRef, useLayoutEffect, createRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes';

import { ToolbarButton } from './ToolbarButton';
export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  /** Determine flex-alignment of child buttons. Needed for overflow behaviour. */
  alignment?: 'left' | 'right';
}

export const ToolbarButtonRow = forwardRef<HTMLDivElement, Props>(
  ({ alignment = 'left', className, children, ...rest }, ref) => {
    const [childVisibility, setChildVisibility] = useState<boolean[]>(
      Array(React.Children.toArray(children).length).fill(true)
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const [showOverflowItems, setShowOverflowItems] = useState(false);
    const overflowItemsRef = createRef<HTMLDivElement>();
    const { overlayProps } = useOverlay(
      { onClose: () => setShowOverflowItems(false), isDismissable: true, isOpen: showOverflowItems },
      overflowItemsRef
    );
    const { dialogProps } = useDialog({}, overflowItemsRef);
    const theme = useTheme2();
    const overflowButtonOrder = alignment === 'left' ? childVisibility.indexOf(false) - 1 : childVisibility.length;
    const styles = getStyles(theme, overflowButtonOrder, alignment);

    useLayoutEffect(() => {
      const intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target instanceof HTMLElement && entry.target.parentNode) {
              const index = Array.prototype.indexOf.call(entry.target.parentNode.children, entry.target);
              setChildVisibility((prev) => {
                const newVisibility = [...prev];
                newVisibility[index] = entry.isIntersecting;
                return newVisibility;
              });
            }
          });
        },
        {
          threshold: 1,
          root: containerRef.current,
        }
      );
      if (containerRef.current) {
        Array.from(containerRef.current.children).forEach((item) => {
          intersectionObserver.observe(item);
        });
      }
      return () => intersectionObserver.disconnect();
    }, []);

    return (
      <div ref={containerRef} className={cx(styles.container, className)} {...rest}>
        {React.Children.map(children, (child, index) => (
          <div
            style={{ order: index, visibility: childVisibility[index] ? 'visible' : 'hidden' }}
            className={styles.childWrapper}
          >
            {child}
          </div>
        ))}
        {childVisibility.includes(false) && (
          <>
            <ToolbarButton
              variant={showOverflowItems ? 'active' : 'default'}
              tooltip="Show more items"
              onClick={() => setShowOverflowItems(!showOverflowItems)}
              className={styles.overflowButton}
              icon="ellipsis-v"
              iconOnly
              narrow
            />
            {showOverflowItems && (
              <FocusScope contain autoFocus>
                <div className={styles.overflowItems} ref={overflowItemsRef} {...overlayProps} {...dialogProps}>
                  {React.Children.toArray(children).map((child, index) => !childVisibility[index] && child)}
                </div>
              </FocusScope>
            )}
          </>
        )}
      </div>
    );
  }
);

ToolbarButtonRow.displayName = 'ToolbarButtonRow';

const getStyles = (theme: GrafanaTheme2, overflowButtonOrder: number, alignment: Props['alignment']) => ({
  overflowButton: css`
    order: ${overflowButtonOrder};
  `,
  overflowItems: css`
    align-items: center;
    background-color: ${theme.colors.background.primary};
    border-radius: ${theme.shape.borderRadius()};
    box-shadow: ${theme.shadows.z3};
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing(1)};
    margin-top: ${theme.spacing(1)};
    max-width: 80vw;
    padding: ${theme.spacing(0.5, 1)};
    position: absolute;
    right: 0;
    top: 100%;
    width: max-content;
    z-index: ${theme.zIndex.sidemenu};
  `,
  container: css`
    align-items: center;
    display: flex;
    gap: ${theme.spacing(1)};
    justify-content: ${alignment === 'left' ? 'flex-start' : 'flex-end'};
    min-width: 0;
    position: relative;
  `,
  childWrapper: css`
    align-items: center;
    display: flex;
    gap: ${theme.spacing(1)};
  `,
});
