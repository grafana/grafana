import React from 'react';
import { css, cx } from 'emotion';
import { TooltipContentProps } from '../../Chart/Tooltip';
import { SingleModeGraphTooltip } from './SingleModeGraphTooltip';
import { MultiModeGraphTooltip } from './MultiModeGraphTooltip';
import { GraphDimensions } from './types';
import { stylesFactory } from '../../../themes/stylesFactory';
import { selectThemeVariant } from '../../../themes/selectThemeVariant';
import { useTheme } from '../../../themes/ThemeContext';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const contextBg = selectThemeVariant({ light: theme.colors.white, dark: theme.colors.black }, theme.type);
  return {
    context: css`
      width: 500px;
      background: ${contextBg};
      pointer-events: auto;
      padding: 5px;
    `,
  };
});

export const GraphTooltip: React.FC<TooltipContentProps<GraphDimensions>> = ({
  mode = 'single',
  dimensions,
  activeDimensions,
  pos,
  isContext,
}) => {
  // When
  // [1] no active dimension or
  // [2] no xAxis position
  // we assume no tooltip should be rendered
  if (!activeDimensions || !activeDimensions.xAxis) {
    return null;
  }

  const theme = useTheme();
  const styles = getStyles(theme);

  if (mode === 'single') {
    return (
      <div className={cx({ [styles.context]: isContext })}>
        <SingleModeGraphTooltip dimensions={dimensions} activeDimensions={activeDimensions} />
      </div>
    );
  } else {
    return (
      <div className={cx({ [styles.context]: isContext })}>
        <MultiModeGraphTooltip dimensions={dimensions} activeDimensions={activeDimensions} pos={pos} />
      </div>
    );
  }
};

GraphTooltip.displayName = 'GraphTooltip';
