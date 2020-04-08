import React, { FC } from 'react';
import { Icon } from '@grafana/ui';

export type LayoutMode = LayoutModes.Grid | LayoutModes.List;

export enum LayoutModes {
  Grid = 'grid',
  List = 'list',
}

interface Props {
  mode: LayoutMode;
  onLayoutModeChanged: (mode: LayoutMode) => {};
}

const LayoutSelector: FC<Props> = props => {
  const { mode, onLayoutModeChanged } = props;
  return (
    <div className="layout-selector">
      <button
        onClick={() => {
          onLayoutModeChanged(LayoutModes.List);
        }}
        className={mode === LayoutModes.List ? 'active' : ''}
      >
        <Icon name="list-ul" />
      </button>
      <button
        onClick={() => {
          onLayoutModeChanged(LayoutModes.Grid);
        }}
        className={mode === LayoutModes.Grid ? 'active' : ''}
      >
        <Icon name="table" />
      </button>
    </div>
  );
};

export default LayoutSelector;
