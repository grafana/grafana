import { css, cx } from '@emotion/css';
import { Property } from 'csstype';
import { forwardRef, PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { ScrollIndicators } from '../CustomScrollbar/ScrollIndicators';
import { getSizeStyles, SizeProps } from '../Layout/utils/styles';

interface Props extends SizeProps {
  hideScrollIndicators?: boolean;
  overflowX?: Property.OverflowX;
  overflowY?: Property.OverflowY;
  scrollbarWidth?: Property.ScrollbarWidth;
}

export const ScrollContainer = forwardRef<HTMLDivElement, PropsWithChildren<Props>>(
  (
    {
      children,
      height,
      hideScrollIndicators = false,
      maxHeight,
      maxWidth,
      minHeight = 0,
      minWidth,
      overflowX = 'auto',
      overflowY = 'auto',
      scrollbarWidth = 'thin',
      width,
    },
    ref
  ) => {
    const sizeStyles = useStyles2(getSizeStyles, width, minWidth, maxWidth, height, minHeight, maxHeight);
    const styles = useStyles2(getStyles, scrollbarWidth, overflowY, overflowX);
    return (
      <div className={cx(sizeStyles, styles.outerWrapper)}>
        <div className={styles.innerWrapper} ref={ref}>
          {hideScrollIndicators ? children : <ScrollIndicators>{children}</ScrollIndicators>}
        </div>
      </div>
    );
  }
);
ScrollContainer.displayName = 'ScrollContainer';

const getStyles = (
  theme: GrafanaTheme2,
  scrollbarWidth: Props['scrollbarWidth'],
  overflowY: Props['overflowY'],
  overflowX: Props['overflowX']
) => ({
  outerWrapper: css({
    display: 'flex',
    position: 'relative',
  }),
  innerWrapper: css({
    flex: 1,
    overflowX,
    overflowY,
    scrollbarWidth,
  }),
});
