import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, ToolbarButton, useStyles2 } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObject, SceneLayoutChildState, SceneComponentProps, SceneLayout } from '../core/types';

interface NestedSceneState extends SceneLayoutChildState {
  title: string;
  isCollapsed?: boolean;
  canCollapse?: boolean;
  canRemove?: boolean;
  layout: SceneLayout;
  actions?: SceneObject[];
}

export class NestedScene extends SceneObjectBase<NestedSceneState> {
  static Component = NestedSceneRenderer;

  onToggle = () => {
    this.setState({
      isCollapsed: !this.state.isCollapsed,
      size: {
        ...this.state.size,
        ySizing: this.state.isCollapsed ? 'fill' : 'content',
      },
    });
  };

  /** Removes itself from it's parent's children array */
  onRemove = () => {
    const parent = this.parent!;
    if ('children' in parent.state) {
      parent.setState({
        children: parent.state.children.filter((x) => x !== this),
      });
    }
  };
}

export function NestedSceneRenderer({ model, isEditing }: SceneComponentProps<NestedScene>) {
  const { title, isCollapsed, canCollapse, canRemove, layout, actions } = model.useState();
  const styles = useStyles2(getStyles);

  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  if (canRemove) {
    toolbarActions.push(
      <ToolbarButton
        icon="times"
        variant={'default'}
        onClick={model.onRemove}
        key="remove-button"
        aria-label="Remove scene"
      />
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <Stack gap={0}>
          <div className={styles.title} role="heading">
            {title}
          </div>
          {canCollapse && (
            <div className={styles.toggle}>
              <Button
                size="sm"
                icon={isCollapsed ? 'angle-down' : 'angle-up'}
                fill="text"
                variant="secondary"
                aria-label={isCollapsed ? 'Expand scene' : 'Collapse scene'}
                onClick={model.onToggle}
              />
            </div>
          )}
        </Stack>
        <div className={styles.actions}>{toolbarActions}</div>
      </div>
      {!isCollapsed && <layout.Component model={layout} isEditing={isEditing} />}
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
