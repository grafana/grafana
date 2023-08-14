import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes';

type AlignItems =
  | 'stretch'
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'baseline'
  | 'start'
  | 'end'
  | 'self-start'
  | 'self-end';

type JustifyContent =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'
  | 'start'
  | 'end'
  | 'left'
  | 'right';

type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';

type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse';

interface FlexProps {
  gap?: ThemeSpacingTokens;
  alignItems?: AlignItems;
  justifyContent?: JustifyContent;
  direction?: Direction;
  wrap?: Wrap;
  height?: number;
  children?: React.ReactNode;
}

export const Flex = ({ gap = 1, alignItems, justifyContent, direction, wrap, children, height }: FlexProps) => {
  const styles = useStyles2(
    useCallback(
      (theme) => getStyles(theme, gap, alignItems, justifyContent, direction, wrap, height),
      [gap, alignItems, justifyContent, direction, wrap, height]
    )
  );

  return <div className={styles.flex}>{children}</div>;
};

Flex.displayName = 'Flex';

const getStyles = (
  theme: GrafanaTheme2,
  gap: ThemeSpacingTokens,
  alignItems: FlexProps['alignItems'],
  justifyContent: FlexProps['justifyContent'],
  direction: FlexProps['direction'],
  wrap: FlexProps['wrap'],
  height: FlexProps['height']
) => {
  return {
    flex: css({
      display: 'flex',
      flexDirection: direction,
      flexWrap: wrap,
      alignItems: alignItems,
      justifyContent: justifyContent,
      gap: theme.spacing(gap),
      height: `${height}px`,
      // width: '100%',
    }),
  };
};
