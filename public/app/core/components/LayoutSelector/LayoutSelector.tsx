import React, { FC } from 'react';

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
        <i className="fa fa-list" />
      </button>
      <button
        onClick={() => {
          onLayoutModeChanged(LayoutModes.Grid);
        }}
        className={mode === LayoutModes.Grid ? 'active' : ''}
      >
        <i className="fa fa-th" />
      </button>
    </div>
  );
};

export default LayoutSelector;
