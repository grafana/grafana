import { css } from '@emotion/css';
import React, { FC, CSSProperties, ComponentType } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { LegendPlacement } from '@grafana/schema';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';

/**
 * @beta
 */
export interface VizLayoutProps {
  width: number;
  height: number;
  legend?: React.ReactElement<VizLayoutLegendProps> | null;
  children: (width: number, height: number) => React.ReactNode;
}

/**
 * @beta
 */
export interface VizLayoutComponentType extends FC<VizLayoutProps> {
  Legend: ComponentType<VizLayoutLegendProps>;
}

/**
 * @beta
 */
export const VizLayout: VizLayoutComponentType = ({ width, height, legend, children }) => {
  const styles = useStyles2(getVizStyles);
  const containerStyle: CSSProperties = {
    display: 'flex',
    width: `${width}px`,
    height: `${height}px`,
  };
  const [legendRef, legendMeasure] = useMeasure<HTMLDivElement>();

  if (!legend) {
    return (
      <>
        {/* tabIndex={0} is needed for keyboard accessibility in the plot area */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div tabIndex={0} style={containerStyle} className={styles.viz}>
          {children(width, height)}
        </div>
      </>
    );
  }

  const { placement, maxHeight = '35%', maxWidth = '60%' } = legend.props;

  let size: VizSize | null = null;

  const legendStyle: CSSProperties = {};

  switch (placement) {
    case 'bottom':
      containerStyle.flexDirection = 'column';
      legendStyle.maxHeight = maxHeight;

      if (legendMeasure) {
        size = { width, height: height - legendMeasure.height };
      }
      break;
    case 'right':
      containerStyle.flexDirection = 'row';
      legendStyle.maxWidth = maxWidth;

      if (legendMeasure) {
        size = { width: width - legendMeasure.width, height };
      }

      if (legend.props.width) {
        legendStyle.width = legend.props.width;
        size = { width: width - legend.props.width, height };
      }
      break;
  }

  // This happens when position is switched from bottom to right
  // Then we preserve old with for one render cycle until legend is measured in it's new position
  if (size?.width === 0) {
    size.width = width;
  }

  if (size?.height === 0) {
    size.height = height;
  }

  return (
    <div style={containerStyle}>
      {/* tabIndex={0} is needed for keyboard accessibility in the plot area */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div tabIndex={0} className={styles.viz}>
        {size && children(size.width, size.height)}
      </div>
      <div style={legendStyle} ref={legendRef}>
        <CustomScrollbar hideHorizontalTrack>{legend}</CustomScrollbar>
      </div>
    </div>
  );
};

export const getVizStyles = (theme: GrafanaTheme2) => {
  return {
    viz: css({
      flexGrow: 2,
      borderRadius: theme.shape.borderRadius(1),
      '&:focus-visible': getFocusStyles(theme),
    }),
  };
};
interface VizSize {
  width: number;
  height: number;
}

/**
 * @beta
 */
export interface VizLayoutLegendProps {
  placement: LegendPlacement;
  children: React.ReactNode;
  maxHeight?: string;
  maxWidth?: string;
  width?: number;
}

/**
 * @beta
 */
export const VizLayoutLegend: FC<VizLayoutLegendProps> = ({ children }) => {
  return <>{children}</>;
};

VizLayout.Legend = VizLayoutLegend;
