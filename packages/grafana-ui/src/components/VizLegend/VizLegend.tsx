import React, { FC, CSSProperties } from 'react';
import { VizOrientation } from '@grafana/data';

interface Props {
  orientation: VizOrientation;
  children: React.ReactNode;
}

export const VizLegend: FC<Props> = ({ children, orientation }) => {
  const styles: CSSProperties = {
    display: 'flex',
  };

  if (orientation === VizOrientation.Vertical) {
    styles.flexDirection = 'column';
  }

  return <div style={styles}>{children}</div>;
};

export interface VizLegendItemProps {
  color: string;
  name: string;
  value?: string;
}

export const VizLegendItem: FC<VizLegendItemProps> = ({ color, name }) => {
  const itemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: '30px',
  };

  const colorSquare: CSSProperties = {
    width: '14px',
    height: '14px',
    borderRadius: '3px',
    background: color,
  };

  const nameStyle: CSSProperties = {
    padding: '0 16px',
  };

  return (
    <div style={itemStyle}>
      <div style={colorSquare}></div>
      <div style={nameStyle}>{name}</div>
    </div>
  );
};
