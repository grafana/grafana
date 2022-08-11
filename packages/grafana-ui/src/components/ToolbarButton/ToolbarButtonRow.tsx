import { css, cx } from '@emotion/css';
import React, { forwardRef, HTMLAttributes, useState, useRef, useLayoutEffect, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { ToolbarButton } from './ToolbarButton';
export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const gap = 8;

export const ToolbarButtonRow = forwardRef<HTMLDivElement, Props>(({ className, children, ...rest }, ref) => {
  const styles = useStyles2(getStyles);
  const visibleRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [numVisibleChildren, setNumVisibleChildren] = useState(React.Children.toArray(children).length);
  const [childWidths, setChildWidths] = useState<number[]>([]);

  const resizeObserver = useMemo(
    () =>
      new ResizeObserver(() => {
        if (visibleRef.current && containerRef.current) {
          if (childWidths.length === 0) {
            setChildWidths(Array.from(visibleRef.current.children).map((child) => child.clientWidth));
          }
          const { clientWidth, scrollWidth } = visibleRef.current;
          const { clientWidth: containerWidth } = containerRef.current;
          let newWidth = scrollWidth;
          let newVisibleChildren = numVisibleChildren;

          if (newWidth > containerWidth) {
            for (let i = numVisibleChildren - 1; i >= 0; i--) {
              if (newWidth > clientWidth) {
                // remove children until we are below the client width
                newWidth -= visibleRef.current.children[i].clientWidth + gap;
              } else {
                newVisibleChildren = i + 1;
                break;
              }
            }
          } else if (newWidth < containerWidth && numVisibleChildren < React.Children.toArray(children).length) {
            // see if we can move children from overflow to visible without exceeding clientWidth
            for (let i = numVisibleChildren; i < React.Children.toArray(children).length; i++) {
              newWidth += childWidths[i] + gap;
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

  return (
    <>
      <div ref={containerRef} className={cx(styles.wrapper, className)} {...rest}>
        <div className={styles.visibleItems} ref={visibleRef}>
          {React.Children.toArray(children).slice(0, numVisibleChildren)}
        </div>
        {/* {overflowChildren} */}
      </div>
      {numVisibleChildren < React.Children.toArray(children).length && (
        <ToolbarButton icon="ellipsis-v" iconOnly narrow />
      )}
    </>
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
