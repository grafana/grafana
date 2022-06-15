import React, { CSSProperties } from 'react';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneObject, SceneObjectSize, SceneObjectState, SceneLayoutState } from './types';

export type FlexLayoutDirection = 'column' | 'row';

interface SceneFlexLayoutState extends SceneObjectState, SceneLayoutState {
  direction?: FlexLayoutDirection;
}

export class SceneFlexLayout extends SceneObjectBase<SceneFlexLayoutState> {
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
  item: SceneObject<SceneObjectState>;
  direction: FlexLayoutDirection;
}) {
  const { size } = item.useMount().useState();

  return (
    <div style={getItemStyles(direction, size)}>
      <item.Component model={item} />
    </div>
  );
}

function getItemStyles(direction: FlexLayoutDirection, sizing: SceneObjectSize = {}) {
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
