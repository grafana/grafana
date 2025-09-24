import { css } from '@emotion/css';
import { Property } from 'csstype';
import { forwardRef, PropsWithChildren, UIEventHandler } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Box, BoxProps } from '../Layout/Box/Box';

import { ScrollIndicators } from './ScrollIndicators';

interface Props extends Omit<BoxProps, 'display' | 'direction' | 'element' | 'flex' | 'position'> {
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
      minWidth: 0,
    };
    const boxProps = { ...defaults, ...rest };

    return (
      <Box {...boxProps} display="flex" direction="column" flex={1} position="relative">
        {/* scrollable containers need tabindex set so keyboard users can focus them to scroll */}
        {/* see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/a7d1a12a6198d546c4a06477b385b4fde03b762e/docs/rules/no-noninteractive-tabindex.md#:~:text=If%20you%20know,scroll%20containers%22. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div tabIndex={0} onScroll={onScroll} className={styles.scroller} ref={ref}>
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
