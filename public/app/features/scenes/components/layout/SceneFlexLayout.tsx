import React, { CSSProperties } from 'react';

import { Field, RadioButtonGroup } from '@grafana/ui';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneObjectSize, SceneLayoutState, SceneComponentProps, SceneObject } from '../../core/types';

export type FlexLayoutDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export type FlexLayoutJustifyContent =
  | 'start'
  | 'end'
  | 'center'
  | 'left'
  | 'right'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'
  | 'stretch'
  | 'baseline'
  | 'first baseline'
  | 'last baseline'
  | 'safe center'
  | 'unsafe center';

export type FlexLayoutAlignContent =
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'
  | 'stretch'
  | 'baseline'
  | 'first baseline'
  | 'last baseline'
  | 'safe center'
  | 'unsafe center';

export type FlexLayoutAlignItems =
  | 'start'
  | 'end'
  | 'center'
  | 'stretch'
  | 'self-start'
  | 'self-end'
  | 'baseline'
  | 'first baseline'
  | 'last baseline'
  | 'safe center'
  | 'unsafe center';

export type FlexLayoutGap = number | string;

interface SceneFlexLayoutState extends SceneLayoutState {
  direction?: FlexLayoutDirection;
  justifyContent?: FlexLayoutJustifyContent;
  alignContent?: FlexLayoutAlignContent;
  alignItems?: FlexLayoutAlignItems;
  gap?: FlexLayoutGap;
  children: SceneObject[];
}

interface SceneFlexChildState extends SceneFlexLayoutState {}

export class SceneFlexChild extends SceneObjectBase<SceneFlexChildState> {
  static Component = FlexLayoutChildComponent;

  getLayout(): SceneFlexLayout {
    if (this.parent instanceof SceneFlexLayout) {
      return this.parent;
    }
    throw new Error('SceneFlexChild must be a child of SceneFlexLayout');
  }
}

export class SceneFlexLayout extends SceneObjectBase<SceneFlexLayoutState> {
  static Component = FlexLayoutRenderer;
  static Editor = FlexLayoutEditor;

  toggleDirection() {
    this.setState({
      direction: this.state.direction === 'row' ? 'column' : 'row',
    });
  }
}

function renderNodes(nodes: SceneObject[], direction: FlexLayoutDirection, isEditing: boolean): React.ReactNode {
  return nodes.map((node) => {
    return <node.Component key={node.state.key} model={node} isEditing={isEditing} />;
  });
}

function FlexLayoutRenderer({ model, isEditing }: SceneComponentProps<SceneFlexLayout>) {
  const {
    direction = 'row',
    justifyContent = 'start',
    alignItems = 'normal',
    alignContent = 'normal',
    gap = 8,
    children,
  } = model.useState();

  return (
    <div
      style={{
        flexGrow: 1,
        flexDirection: direction,
        display: 'flex',
        gap,
        justifyContent,
        alignItems,
        alignContent,
        height: '100%',
      }}
    >
      {renderNodes(children, direction, Boolean(isEditing))}
    </div>
  );
}

export function FlexLayoutChildComponent({ model, isEditing }: SceneComponentProps<SceneFlexChild>) {
  const { children, size } = model.useState();
  const { direction } = model.getLayout().useState();

  return (
    // Rethink, the wrapping div here may cause issues ltr on
    <div style={getItemStyles(direction || 'column', size)}>
      {renderNodes(children, direction || 'column', Boolean(isEditing))}
    </div>
  );
}

function getItemStyles(direction: FlexLayoutDirection, sizing: SceneObjectSize = {}) {
  const { xSizing = 'fill', ySizing = 'fill' } = sizing;

  const style: CSSProperties = {
    display: 'flex',
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
