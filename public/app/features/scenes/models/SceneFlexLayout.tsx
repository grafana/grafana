import React, { CSSProperties } from 'react';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneObject, SceneObjectSize, SceneObjectState, SceneLayoutState } from './types';

export type FlexLayoutDirection = 'column' | 'row';

interface SceneFlexLayoutState extends SceneObjectState, SceneLayoutState {
  direction?: FlexLayoutDirection;
}

export class SceneFlexLayout extends SceneObjectBase<SceneFlexLayoutState> {
  Component = FlexLayoutRenderer;

  toggleDirection() {
    this.setState({
      direction: this.state.direction === 'row' ? 'column' : 'row',
    });
  }
}

function FlexLayoutRenderer({ model }: { model: SceneFlexLayout }) {
  const { direction = 'row', children } = model.useState();

  return (
    <div style={{ flexGrow: 1, flexDirection: direction, display: 'flex', gap: '8px' }}>
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
  const { xSizing = 'fill', ySizing = 'fill' } = sizing;

  const style: CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    minWidth: sizing.minWidth,
    minHeight: sizing.minHeight,
  };

  if (direction === 'column') {
    if (sizing.height) {
      style.height = sizing.height;
    } else {
      style.flexGrow = ySizing === 'fill' ? 1 : 0;
    }

    if (sizing.width) {
      style.width = sizing.width;
    } else {
      style.alignSelf = xSizing === 'fill' ? 'stretch' : 'normal';
    }
  } else {
    if (sizing.height) {
      style.height = sizing.height;
    } else {
      style.alignSelf = ySizing === 'fill' ? 'stretch' : 'normal';
    }

    if (sizing.width) {
      style.width = sizing.width;
    } else {
      style.flexGrow = xSizing === 'fill' ? 1 : 0;
    }
  }

  return style;
}
