import React, { CSSProperties } from 'react';

import { Field, RadioButtonGroup } from '@grafana/ui';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutChild, SceneLayoutState, SceneLayoutChildOptions } from '../../core/types';

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
  const { placement } = item.useState();

  return (
    <div style={getItemStyles(direction, placement)}>
      <item.Component model={item} isEditing={isEditing} />
    </div>
  );
}

function getItemStyles(direction: FlexLayoutDirection, layout: SceneLayoutChildOptions = {}) {
  const { xSizing = 'fill', ySizing = 'fill' } = layout;

  const style: CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    minWidth: layout.minWidth,
    minHeight: layout.minHeight,
    position: 'relative',
  };

  if (direction === 'column') {
    if (layout.height) {
      style.height = layout.height;
    } else {
      style.flexGrow = ySizing === 'fill' ? 1 : 0;
    }

    if (layout.width) {
      style.width = layout.width;
    } else {
      style.alignSelf = xSizing === 'fill' ? 'stretch' : 'flex-start';
    }
  } else {
    if (layout.height) {
      style.height = layout.height;
    } else {
      style.alignSelf = ySizing === 'fill' ? 'stretch' : 'flex-start';
    }

    if (layout.width) {
      style.width = layout.width;
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
