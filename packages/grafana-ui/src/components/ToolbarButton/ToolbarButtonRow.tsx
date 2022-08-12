import { css, cx } from '@emotion/css';
import React, { forwardRef, HTMLAttributes, useState, useRef, useLayoutEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { Dropdown } from '../Dropdown/Dropdown';

import { ToolbarButton } from './ToolbarButton';
export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const ToolbarButtonRow = forwardRef<HTMLDivElement, Props>(({ className, children, ...rest }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [childVisibility, setChildVisibility] = useState<boolean[]>(
    Array(React.Children.toArray(children).length).fill(true)
  );
  const theme = useTheme2();
  const styles = getStyles(theme, childVisibility.indexOf(false) - 1);

  useLayoutEffect(() => {
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target instanceof HTMLElement && entry.target.parentNode) {
            const index = Array.prototype.indexOf.call(entry.target.parentNode.children, entry.target);
            entry.target.style.visibility = entry.isIntersecting ? 'visible' : 'hidden';
            entry.target.style.order = index.toString();
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

  const renderOverflowChildren = () => (
    <div className={styles.overflowItems}>
      {React.Children.toArray(children).map((child, index) => !childVisibility[index] && child)}
    </div>
  );

  return (
    <div ref={containerRef} className={cx(styles.wrapper, className)} {...rest}>
      {children}
      {childVisibility.includes(false) && (
        <Dropdown overlay={renderOverflowChildren}>
          <ToolbarButton className={styles.overflowButton} icon="ellipsis-v" iconOnly narrow />
        </Dropdown>
      )}
    </div>
  );
});

ToolbarButtonRow.displayName = 'ToolbarButtonRow';

const getStyles = (theme: GrafanaTheme2, order: number) => ({
  overflowButton: css`
    order: ${order};
  `,
  overflowItems: css`
    align-items: center;
    background-color: ${theme.colors.background.primary};
    border-radius: ${theme.shape.borderRadius()};
    box-shadow: ${theme.shadows.z3};
    display: flex;
    gap: ${theme.spacing(1)};
    margin: ${theme.spacing(0, 0.5)};
    padding: ${theme.spacing(0.5, 1)};
  `,
  wrapper: css`
    align-items: center;
    display: flex;
    flex: 1;
    gap: ${theme.spacing(1)};
    min-width: 0;
  `,
});
