import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2, useTheme2 } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObject, SceneObjectState, SceneLayoutState, SceneComponentProps } from '../core/types';

interface SceneRowState extends SceneObjectState {
  title: string;
  isCollapsed?: boolean;
  layout: SceneObject<SceneLayoutState>;
}

export class SceneRow extends SceneObjectBase<SceneRowState> {
  static Component = SceneRowRenderer;

  onToggle = () => {
    this.setState({
      isCollapsed: !this.state.isCollapsed,
      size: {
        ...this.state.size,
        ySizing: this.state.isCollapsed ? 'fill' : 'content',
      },
    });
  };
}

export function SceneRowRenderer({ model, isEditing }: SceneComponentProps<SceneRow>) {
  const { title, isCollapsed, layout } = model.useState();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader} onClick={model.onToggle}>
        <div className={styles.title}>{title}</div>
        <div className={styles.toggle}>
          <Button icon={isCollapsed ? 'angle-down' : 'angle-up'} fill="text" variant="secondary" />
        </div>
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
});
