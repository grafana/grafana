import React, { CSSProperties } from 'react';

import { SceneLayoutState, SceneItem, SceneItemSizing } from './SceneItem';

export type FlexLayoutDirection = 'column' | 'row';

interface SceneFlexLayoutState extends SceneLayoutState {
  direction?: FlexLayoutDirection;
}

export class SceneFlexLayout extends SceneItem<SceneFlexLayoutState> {
  Component = FlexLayoutRenderer;
}

function FlexLayoutRenderer({ model }: { model: SceneFlexLayout }) {
  const { direction, children } = model.useState();

  return (
    <div style={{ flexGrow: 1, flexDirection: direction, display: 'flex', gap: '16px' }}>
      {children.map((item) => (
        <item.Component key={item.state.key} model={item} />
      ))}
    </div>
  );
}

function getItemStyles(sizing: SceneItemSizing, direction: FlexLayoutDirection) {
  const style: CSSProperties = {
    display: 'flex',
    flexDirection: direction,
  };

  if (direction === 'column') {
    style.flexGrow = sizing.hSizing === 'fill' ? 1 : 0;

    if (sizing.vSizing === 'fill') {
      style.alignSelf = 'stretch';
    } else {
      style.width = sizing.width;
    }
  }
}
