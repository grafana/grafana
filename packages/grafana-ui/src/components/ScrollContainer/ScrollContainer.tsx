import { css } from '@emotion/css';
import { Property } from 'csstype';
import { forwardRef, PropsWithChildren, UIEventHandler } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Box, BoxProps } from '../Layout/Box/Box';

import { ScrollIndicators } from './ScrollIndicators';

interface Props extends Omit<BoxProps, 'display' | 'direction' | 'flex' | 'position'> {
  showScrollIndicators?: boolean;
  onScroll?: UIEventHandler<HTMLDivElement>;
  overflowX?: Property.OverflowX;
  overflowY?: Property.OverflowY;
  scrollbarWidth?: Property.ScrollbarWidth;
}

export const ScrollContainer = forwardRef<HTMLDivElement, PropsWithChildren<Props>>(
  (
    {
      children,
      showScrollIndicators = false,
      onScroll,
      overflowX = 'auto',
      overflowY = 'auto',
      scrollbarWidth = 'thin',
      ...rest
    },
    ref
  ) => {
    const styles = useStyles2(getStyles, scrollbarWidth, overflowY, overflowX);
    const defaults: Partial<BoxProps> = {
      maxHeight: '100%',
      minHeight: 0,
    };
    const boxProps = { ...defaults, ...rest };

    return (
      <Box {...boxProps} display="flex" direction="column" flex={1} position="relative">
        <div onScroll={onScroll} className={styles.scroller} ref={ref}>
          {showScrollIndicators ? <ScrollIndicators>{children}</ScrollIndicators> : children}
        </div>
      </Box>
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
  scroller: css({
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    overflowX,
    overflowY,
    scrollbarWidth,
  }),
});
