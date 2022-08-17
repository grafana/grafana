import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneLayoutChildState, SceneComponentProps, SceneLayoutState, SceneWithActionState } from '../core/types';
import { Orientation, SceneToolboxLayout } from './SceneToolboxLayout';

interface NestedSceneState extends SceneLayoutChildState, SceneLayoutState {
  title: string;
  isCollapsed?: boolean;
  canCollapse?: boolean;
  canRemove?: boolean;
  // layout: SceneLayout;
  // actions?: SceneObject[];
}

export class NestedScene extends SceneObjectBase<NestedSceneState> {
  static Component = NestedSceneRenderer;
  private sceneCollapser: SceneCollapser;

  constructor(state: NestedSceneState) {
    super(state);

    this.sceneCollapser = new SceneCollapser({
      canCollapse: Boolean(state.canCollapse),
      canRemove: Boolean(state.canRemove),
      isCollapsed: Boolean(state.isCollapsed),
      onCollapse: this.onToggle,
      showInToolbox: true,
    });

    const children = [
      new SceneToolboxLayout({
        orientation: Orientation.Vertical,
        children: [this.sceneCollapser, ...state.children],
      }),
    ];

    this.setState({ children });
  }

  onToggle = () => {
    this.sceneCollapser.setState({ isCollapsed: !this.state.isCollapsed });
    this.setState({
      isCollapsed: !this.state.isCollapsed,
      size: {
        ...this.state.size,
        ySizing: this.state.isCollapsed ? 'fill' : 'content',
      },
    });

    if (!this.state.isCollapsed) {
      this.deactivate();
    }
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
}

interface SceneCollapserState extends SceneLayoutChildState, SceneWithActionState {
  canRemove: boolean;
  canCollapse: boolean;
  isCollapsed?: boolean;
  onCollapse: () => void;
}

export function SceneCollapserRenderer({ model, isEditing }: SceneComponentProps<SceneCollapser>) {
  const { isCollapsed, onCollapse } = model.useState();

  return <ToolbarButton onClick={onCollapse}>{isCollapsed ? 'Expand' : 'Collapse'}</ToolbarButton>;
}

export class SceneCollapser extends SceneObjectBase<SceneCollapserState> {
  static Component = SceneCollapserRenderer;
}

export function NestedSceneRenderer({ model, isEditing }: SceneComponentProps<NestedScene>) {
  const { title, isCollapsed, children } = model.useState();
  const collapsibleState = children[0].useState();

  const [collapse, ...otherChildren] = collapsibleState.children;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <Stack gap={0}>
          <div className={styles.title} role="heading">
            {title}
          </div>
        </Stack>
      </div>
      <collapse.Component model={collapse} isEditing={isEditing} />
      {!isCollapsed && otherChildren.map((child) => <child.Component model={child} isEditing={isEditing} />)}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: theme.spacing(1),
    cursor: 'pointer',
  }),
  toggle: css({}),
  title: css({
    fontSize: theme.typography.h5.fontSize,
  }),
  rowHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  }),
  actions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    justifyContent: 'flex-end',
    flexGrow: 1,
  }),
});
