import { css, cx } from '@emotion/css';
import React, { forwardRef, HTMLAttributes, useState, useRef, useLayoutEffect, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Dropdown } from '../Dropdown/Dropdown';

import { ToolbarButton } from './ToolbarButton';
export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const gap = 8;
const overflowButtonWidth = 28;
const fudgeFactor = 3;

export const ToolbarButtonRow = forwardRef<HTMLDivElement, Props>(({ className, children, ...rest }, ref) => {
  const styles = useStyles2(getStyles);
  const innerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [numVisibleChildren, setNumVisibleChildren] = useState(React.Children.toArray(children).length);
  const [childWidths, setChildWidths] = useState<number[]>([]);

  const resizeObserver = useMemo(
    () =>
      new ResizeObserver((entries) => {
        window.requestAnimationFrame(() => {
          // prevent an infinite loop when the children change
          if (!Array.isArray(entries) || !entries.length) {
            return;
          }
          if (innerRef.current && containerRef.current) {
            if (childWidths.length === 0) {
              setChildWidths(
                Array.from(innerRef.current.children).map((child) => {
                  return child instanceof HTMLElement ? child.offsetWidth : 0;
                })
              );
            }
            const { offsetWidth, scrollWidth } = innerRef.current;
            const { clientWidth: containerWidth } = containerRef.current;
            let newWidth = scrollWidth;
            let newVisibleChildren = numVisibleChildren;

            if (newWidth > containerWidth + fudgeFactor) {
              // add the overflow button
              newWidth += overflowButtonWidth + gap;
              for (let i = numVisibleChildren - 1; i >= 0; i--) {
                if (newWidth > offsetWidth) {
                  // remove children until we are below the client width
                  newWidth -= childWidths[i] + gap;
                } else {
                  newVisibleChildren = i + 1;
                  break;
                }
              }
            } else if (newWidth < containerWidth && numVisibleChildren < React.Children.toArray(children).length) {
              // see if we can move children from overflow to visible without exceeding clientWidth
              for (let i = numVisibleChildren; i < React.Children.toArray(children).length; i++) {
                newWidth += childWidths[i] + gap;
                // remove overflow button if we're adding the last child back
                if (i === React.Children.toArray(children).length - 1) {
                  newWidth -= overflowButtonWidth + gap;
                }
                if (newWidth > containerWidth) {
                  break;
                } else {
                  newVisibleChildren = i + 1;
                }
              }
            }

            if (newVisibleChildren !== numVisibleChildren) {
              setNumVisibleChildren(newVisibleChildren);
            }
          }
        });
      }),
    [childWidths, children, numVisibleChildren]
  );

  useLayoutEffect(() => {
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [resizeObserver]);

  const renderOverflowChildren = () => (
    <div className={styles.overflowItems}>{React.Children.toArray(children).slice(numVisibleChildren)}</div>
  );

  return (
    <div ref={containerRef} className={cx(styles.wrapper, className)} {...rest}>
      <div className={styles.visibleItems} ref={innerRef}>
        {React.Children.toArray(children).slice(0, numVisibleChildren)}
        {numVisibleChildren < React.Children.toArray(children).length && (
          <Dropdown overlay={renderOverflowChildren}>
            <ToolbarButton icon="ellipsis-v" iconOnly narrow />
          </Dropdown>
        )}
      </div>
    </div>
  );
});

ToolbarButtonRow.displayName = 'ToolbarButtonRow';

const getStyles = (theme: GrafanaTheme2) => ({
  overflowItems: css`
    align-items: center;
    border-radius: ${theme.shape.borderRadius()};
    box-shadow: ${theme.shadows.z3};
    display: flex;
    gap: ${theme.spacing(1)};
    margin: ${theme.spacing(0, 0.5)};
    padding: ${theme.spacing(1)};
  `,
  visibleItems: css`
    display: inline-flex;
    gap: ${theme.spacing(1)};
    max-width: 100%;
  `,
  wrapper: css`
    display: flex;
    flex: 1;
    max-width: 100%;
  `,
});
