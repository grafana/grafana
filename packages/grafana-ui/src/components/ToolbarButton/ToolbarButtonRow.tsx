import { css, cx } from '@emotion/css';
import React, { forwardRef, HTMLAttributes, useState, useRef, useLayoutEffect, useMemo, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { ToolbarButton } from './ToolbarButton';
export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const gap = 8;

export const ToolbarButtonRow = forwardRef<HTMLDivElement, Props>(({ className, children, ...rest }, ref) => {
  const styles = useStyles2(getStyles);
  const [showMoreVisible, setShowMoreVisible] = useState(false);
  const visibleRef = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const [visibleChildren, setVisibleChildren] = useState<ReactNode[]>(React.Children.toArray(children));
  const [overflowChildren, setOverflowChildren] = useState<ReactNode[]>([]);
  const [childWidths, setChildWidths] = useState<number[]>([]);

  const resizeObserver = useMemo(
    () =>
      new ResizeObserver((entries) => {
        for (let entry of entries) {
          if (visibleRef.current && ref2.current) {
            if (childWidths.length === 0) {
              setChildWidths(Array.from(visibleRef.current.children).map((child) => child.clientWidth));
            }
            const { clientWidth, scrollWidth, childElementCount } = visibleRef.current;
            const { clientWidth: clientWidth2 } = ref2.current;
            let newVisibleChildren = visibleChildren.slice();
            let newOverflowChildren = overflowChildren.slice();
            let newWidth = scrollWidth;

            if (newWidth > clientWidth2) {
              // move children from visible to overflow until newWidth is less than clientWidth
              for (let i = childElementCount - 1; i >= 0; i--) {
                if (newWidth > clientWidth) {
                  // remove children until we are below the client width
                  newVisibleChildren = React.Children.toArray(children).slice(0, i);
                  newOverflowChildren = React.Children.toArray(children).slice(i);
                  newWidth -= visibleRef.current.children[i].clientWidth + gap;
                } else {
                  break;
                }
              }
            } else if (newWidth < clientWidth2 && overflowChildren.length > 0) {
              // see if we can move children from overflow to visible without exceeding clientWidth
              for (let i = 0; i < overflowChildren.length; i++) {
                newWidth += childWidths[visibleChildren.length + i] + gap;
                if (newWidth <= clientWidth2) {
                  const childToMove = newOverflowChildren.shift();
                  newVisibleChildren.push(childToMove);
                } else {
                  break;
                }
              }
            }

            if (newVisibleChildren.length !== visibleChildren.length) {
              setVisibleChildren(newVisibleChildren);
              setOverflowChildren(newOverflowChildren);
              setShowMoreVisible(newOverflowChildren.length > 0);
            }
          }
        }
      }),
    [childWidths, children, overflowChildren, visibleChildren]
  );

  useLayoutEffect(() => {
    if (ref2.current) {
      resizeObserver.observe(ref2.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [resizeObserver]);

  return (
    <div ref={ref2} className={cx(styles.wrapper, className)} {...rest}>
      <div className={styles.visibleItems} ref={visibleRef}>
        {visibleChildren}
      </div>
      {showMoreVisible && <ToolbarButton icon="ellipsis-v" iconOnly narrow />}
      {/* {overflowChildren} */}
    </div>
  );
});

ToolbarButtonRow.displayName = 'ToolbarButtonRow';

const getStyles = (theme: GrafanaTheme2) => ({
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
