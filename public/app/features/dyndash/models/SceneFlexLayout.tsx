import React, { CSSProperties } from 'react';

import { SceneItemBase } from './SceneItem';
import { SceneItem, SceneItemSizing, SceneItemState, SceneLayoutState } from './types';

export type FlexLayoutDirection = 'column' | 'row';

interface SceneFlexLayoutState extends SceneItemState, SceneLayoutState {
  direction?: FlexLayoutDirection;
}

export class SceneFlexLayout extends SceneItemBase<SceneFlexLayoutState> {
  Component = FlexLayoutRenderer;
}

function FlexLayoutRenderer({ model }: { model: SceneFlexLayout }) {
  const { direction = 'row', children } = model.useState();

  return (
    <div style={{ flexGrow: 1, flexDirection: direction, display: 'flex', gap: '16px' }}>
      {children.map((item) => (
        <FlexLayoutChildComponent key={item.state.key} item={item} direction={direction} />
      ))}
    </div>
  );
}

function FlexLayoutChildComponent({
  item,
  direction,
}: {
  item: SceneItem<SceneItemState>;
  direction: FlexLayoutDirection;
}) {
  const { size } = item.useState();

  return (
    <div style={getItemStyles(direction, size)}>
      <item.Component model={item} />
    </div>
  );
}

function getItemStyles(direction: FlexLayoutDirection, sizing: SceneItemSizing = {}) {
  const { vSizing = 'fill', hSizing = 'fill' } = sizing;

  const style: CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    minWidth: sizing.minWidth,
    minHeight: sizing.minHeight,
  };

  if (direction === 'column') {
    if (vSizing === 'fill') {
      style.flexGrow = 1;
    } else {
      style.height = sizing.height;
    }

    if (hSizing === 'fill') {
      style.alignSelf = 'stretch';
    } else {
      style.width = sizing.width;
    }
  } else {
    if (vSizing === 'fill') {
      style.alignSelf = 'stretch';
    } else {
      style.height = sizing.height;
    }

    if (hSizing === 'fill') {
      style.flexGrow = 1;
    } else {
      style.width = sizing.width;
    }
  }

  return style;
}
