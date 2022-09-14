import React from 'react';

import { ToolbarButton } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import {
  SceneLayoutChildState,
  SceneComponentProps,
  SceneLayoutState,
  SceneLayoutChild,
  SceneObject,
} from '../core/types';

import { SceneCanvasText } from './SceneCanvasText';
import { SceneFlexLayout, SceneFlexChild } from './SceneFlexLayout';
import { SceneToolbar } from './SceneToolbar';
import { serializeNode, serializeScene } from '../core/serialization';

interface NestedSceneState extends SceneLayoutChildState, SceneLayoutState {
  title: string;
  isCollapsed?: boolean;
  canCollapse?: boolean;
  canRemove?: boolean;
  actions?: SceneObject[];
}

export class NestedScene extends SceneObjectBase<NestedSceneState> {
  static Component = NestedSceneRenderer;

  private sceneCollapser: SceneCollapser;
  private collapsibleChildren: SceneLayoutChild[] = [];

  constructor(state: NestedSceneState) {
    super(state);

    this.collapsibleChildren = state.children;

    this.sceneCollapser = new SceneCollapser({
      canCollapse: Boolean(state.canCollapse),
      canRemove: Boolean(state.canRemove),
      isCollapsed: Boolean(state.isCollapsed),
      onCollapse: this.onToggle,
      onRemove: this.onRemove,
    });

    const children = this.buildSceneChildren(Boolean(state.isCollapsed));
    this.setState({ children });
  }

  private buildSceneChildren = (isCollapsed: boolean) => {
    const children = isCollapsed
      ? []
      : [
          new SceneFlexChild({
            children: this.collapsibleChildren,
          }),
        ];

    const actionChildren = this.state.actions ? [...this.state.actions, this.sceneCollapser] : [this.sceneCollapser];

    return [
      new SceneFlexChild({
        size: { ySizing: isCollapsed ? 'content' : 'fill' },
        children: [
          new SceneFlexLayout({
            direction: 'column',
            children: [
              new SceneFlexChild({
                size: {
                  ySizing: 'content',
                },
                children: [
                  new SceneToolbar({
                    orientation: 'horizontal',
                    children: [
                      new SceneFlexLayout({
                        direction: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        children: [
                          new SceneFlexChild({
                            size: {
                              xSizing: 'content',
                            },
                            children: [
                              new SceneCanvasText({
                                text: this.state.title,
                              }),
                            ],
                          }),
                          new SceneFlexChild({
                            size: {
                              xSizing: 'content',
                            },
                            children: [
                              new SceneFlexLayout({
                                children: isCollapsed ? [this.sceneCollapser] : actionChildren,
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              ...children,
            ],
          }),
        ],
      }),
    ];
  };

  onToggle = () => {
    const isCollapsed = !this.state.isCollapsed;
    const children = this.buildSceneChildren(isCollapsed);

    this.sceneCollapser.setState({ isCollapsed });
    this.setState({
      children,
      isCollapsed,
      size: {
        ...this.state.size,
        ySizing: this.state.isCollapsed ? 'fill' : 'content',
      },
    });
  };

  /** Removes itself from its parent's children array */
  onRemove = () => {
    const parent = this.parent!;
    if ('children' in parent.state) {
      parent.setState({
        children: parent.state.children.filter((x) => x !== this),
      });
    }
  };

  toJSON() {
    // preparing clone to avoid serializing dynamically created children
    const clone = this.clone();
    clone.setState({ children: this.collapsibleChildren });

    return {
      ...serializeScene(clone, true),
      actions: this.state.actions?.map((x) => serializeNode(x)) || [],
      isCollapsed: Boolean(this.state.isCollapsed),
      canCollapse: Boolean(this.state.canCollapse),
      canRemove: Boolean(this.state.canRemove),
    };
  }
}

interface SceneCollapserState extends SceneLayoutChildState {
  canRemove: boolean;
  canCollapse: boolean;
  isCollapsed?: boolean;
  onCollapse?: () => void;
  onRemove?: () => void;
}

export function NestedSceneRenderer({ model, isEditing }: SceneComponentProps<NestedScene>) {
  const { children } = model.useState();

  return (
    <>
      {children.map((child) => (
        <child.Component key={child.state.key} model={child} isEditing={isEditing} />
      ))}
    </>
  );
}

export class SceneCollapser extends SceneObjectBase<SceneCollapserState> {
  static Component = SceneCollapserRenderer;
}

export function SceneCollapserRenderer({ model }: SceneComponentProps<SceneCollapser>) {
  const { canCollapse, canRemove, isCollapsed, onCollapse, onRemove } = model.useState();

  return (
    <>
      {canCollapse && onCollapse && (
        <ToolbarButton onClick={onCollapse}>{isCollapsed ? 'Expand scene' : 'Collapse scene'}</ToolbarButton>
      )}
      {canRemove && onRemove && <ToolbarButton onClick={onRemove}>Remove scene</ToolbarButton>}
    </>
  );
}
