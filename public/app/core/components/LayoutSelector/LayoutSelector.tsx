import React, { FC } from 'react';
import { RadioButtonGroup } from '@grafana/ui';

export type LayoutMode = LayoutModes.Grid | LayoutModes.List;

export enum LayoutModes {
  Grid = 'grid',
  List = 'list',
}

interface Props {
  mode: LayoutMode;
  onLayoutModeChanged: (mode: LayoutMode) => {};
}

const options = [
  { icon: 'table', value: LayoutModes.Grid },
  { icon: 'list-ul', value: LayoutModes.List },
];

const LayoutSelector: FC<Props> = ({ mode, onLayoutModeChanged }) => (
  <div className="layout-selector">
    <RadioButtonGroup value={mode} options={options} onChange={onLayoutModeChanged} />
  </div>
);

export default LayoutSelector;
