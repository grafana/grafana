import React, { CSSProperties } from 'react';

import { Field, RadioButtonGroup } from '@grafana/ui';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutChild, SceneLayoutState, SceneObjectSize } from '../../core/types';

export type FlexLayoutDirection = 'column' | 'row';

interface SceneFlexLayoutState extends SceneLayoutState {
  direction?: FlexLayoutDirection;
}

export class SceneFlexLayout extends SceneObjectBase<SceneFlexLayoutState> {
  public static Component = FlexLayoutRenderer;
  public static Editor = FlexLayoutEditor;

  public toggleDirection() {
    this.setState({
      direction: this.state.direction === 'row' ? 'column' : 'row',
    });
  }
}

function FlexLayoutRenderer({ model, isEditing }: SceneComponentProps<SceneFlexLayout>) {
  const { direction = 'row', children } = model.useState();

  return (
    <div style={{ flexGrow: 1, flexDirection: direction, display: 'flex', gap: '8px' }}>
      {children.map((item) => (
        <FlexLayoutChildComponent key={item.state.key} item={item} direction={direction} isEditing={isEditing} />
      ))}
    </div>
  );
}

function FlexLayoutChildComponent({
  item,
  direction,
  isEditing,
}: {
  item: SceneLayoutChild;
  direction: FlexLayoutDirection;
  isEditing?: boolean;
}) {
  const { size } = item.useState();

  return (
    <div style={getItemStyles(direction, size)}>
      <item.Component model={item} isEditing={isEditing} />
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
      style.alignSelf = xSizing === 'fill' ? 'stretch' : 'flex-start';
    }
  } else {
    if (sizing.height) {
      style.height = sizing.height;
    } else {
      style.alignSelf = ySizing === 'fill' ? 'stretch' : 'flex-start';
    }

    if (sizing.width) {
      style.width = sizing.width;
    } else {
      style.flexGrow = xSizing === 'fill' ? 1 : 0;
    }
  }

  return style;
}

function FlexLayoutEditor({ model }: SceneComponentProps<SceneFlexLayout>) {
  const { direction = 'row' } = model.useState();
  const options = [
    { icon: 'arrow-right', value: 'row' },
    { icon: 'arrow-down', value: 'column' },
  ];

  return (
    <Field label="Direction">
      <RadioButtonGroup
        options={options}
        value={direction}
        onChange={(value) => model.setState({ direction: value as FlexLayoutDirection })}
      />
    </Field>
  );
}
