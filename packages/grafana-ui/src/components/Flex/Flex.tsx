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

// type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';

// type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse';

type FlexFlow =
  | 'row wrap'
  | 'row nowrap'
  | 'column wrap'
  | 'column nowrap'
  | 'row-reverse wrap'
  | 'row-reverse nowrap'
  | 'column-reverse wrap'
  | 'column-reverse nowrap'
  | 'row wrap-reverse'
  | 'row nowrap-reverse'
  | 'column wrap-reverse'
  | 'column nowrap-reverse'
  | 'row-reverse wrap-reverse'
  | 'row-reverse nowrap-reverse'
  | 'column-reverse wrap-reverse'
  | 'column-reverse nowrap-reverse';

interface FlexProps {
  gap?: ThemeSpacingTokens;
  alignItems?: AlignItems;
  justifyContent?: JustifyContent;
  // direction?: Direction;
  // wrap?: Wrap;
  flexFlow?: FlexFlow;
  children?: React.ReactNode;
}

export const Flex = ({ gap = 1, alignItems, justifyContent, /*direction, wrap*/ flexFlow, children }: FlexProps) => {
  const styles = useStyles2(
    useCallback(
      (theme) => getStyles(theme, gap, alignItems, justifyContent, /*direction, wrap*/ flexFlow),
      [gap, alignItems, justifyContent, /*direction, wrap*/ flexFlow]
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
  // direction: FlexProps['direction'],
  // wrap: FlexProps['wrap']
  flexFlow: FlexProps['flexFlow']
) => {
  return {
    flex: css({
      display: 'flex',
      flexFlow: flexFlow,
      alignItems: alignItems,
      justifyContent: justifyContent,
      gap: theme.spacing(gap),
    }),
  };
};
