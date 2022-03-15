import React from 'react';
import { FlameGraphRenderer } from './FlameGraph/FlameGraphRenderer';

interface RenderWrapperProps {
  width: number;
  height: number;
  flamebearer: any;
}

export const FlameGraphRendererWrapper: React.FunctionComponent<RenderWrapperProps> = ({
  width,
  height,
  flamebearer,
}) => {
  return (
    <div style={{ width, height, overflowY: 'auto' }}>
      <FlameGraphRenderer
        flamebearer={flamebearer}
        ExportData={<div />}
        display="flamegraph"
        viewType="single"
        showToolbar={false}
      />
    </div>
  );
};
