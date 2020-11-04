import React, { FC, CSSProperties, ComponentType } from 'react';
import { useMeasure } from 'react-use';
import CustomScrollbar from '../CustomScrollbar/CustomScrollbar';

/**
 * @beta
 */
export interface Props {
  width: number;
  height: number;
  legend?: React.ReactElement<VizLayoutLegendProps>;
  children: (width: number, height: number) => React.ReactNode;
}

/**
 * @beta
 */
export interface VizLayoutType extends FC<Props> {
  Legend: ComponentType<VizLayoutLegendProps>;
}

/**
 * @beta
 */
export const VizLayout: VizLayoutType = ({ width, height, legend, children }) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    width: `${width}px`,
    height: `${height}px`,
  };

  if (!legend) {
    return <div style={containerStyle}>{children(width, height)}</div>;
  }

  const { position, maxHeight, maxWidth } = legend.props;
  const [legendRef, legendMeasure] = useMeasure();
  let size: VizSize | null = null;

  const vizStyle: CSSProperties = {
    flexGrow: 1,
  };

  const legendStyle: CSSProperties = {
    flexGrow: 1,
  };

  let positionWithAuto = position ?? 'auto';
  if (position === 'auto') {
    positionWithAuto = width > height ? 'right' : 'bottom';
  }

  switch (positionWithAuto) {
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
      break;
  }

  return (
    <div style={containerStyle}>
      <div style={vizStyle}>{size && children(size.width, size.height)}</div>
      <div style={legendStyle} ref={legendRef}>
        <CustomScrollbar>{legend}</CustomScrollbar>
      </div>
    </div>
  );
};

interface VizSize {
  width: number;
  height: number;
}

/**
 * @beta
 */
export interface VizLayoutLegendProps {
  position?: 'bottom' | 'right' | 'auto';
  maxHeight?: string;
  maxWidth?: string;
  children: React.ReactNode;
}

/**
 * @beta
 */
export const VizLayoutLegend: FC<VizLayoutLegendProps> = ({ children }) => {
  return <>{children}</>;
};

VizLayout.Legend = VizLayoutLegend;
