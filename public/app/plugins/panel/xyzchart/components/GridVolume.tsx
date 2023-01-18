import React from 'react';

import { Direction, GridVolumeProps } from '../types';

import { GridPlane } from './GridPlane';

export const GridVolume = ({ intervalLabels }: GridVolumeProps) => {
  return (
    <group>
      <GridPlane direction={Direction.Up} intervalLabels={intervalLabels.yLabels} />
      <GridPlane direction={Direction.Right} intervalLabels={intervalLabels.xLabels} />
      <GridPlane direction={Direction.Forward} intervalLabels={intervalLabels.zLabels} />
    </group>
  );
};
