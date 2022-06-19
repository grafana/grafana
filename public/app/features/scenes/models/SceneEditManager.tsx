import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneEditorState, SceneEditor, SceneObject, SceneComponentProps, SceneComponent } from './types';

export class SceneEditManager extends SceneObjectBase<SceneEditorState> implements SceneEditor {
  static Component = SceneEditorRenderer;

  get Component(): SceneComponent<this> {
    return SceneEditorRenderer;
  }

  mouseEnter(model: SceneObject) {
    this.setState({ hoverObject: { ref: model } });
  }

  mouseLeave(model: SceneObject) {
    if (model.parent) {
      this.setState({ hoverObject: { ref: model.parent } });
    } else {
      this.setState({ hoverObject: undefined });
    }
  }

  selectObject(model: SceneObject) {
    this.setState({ selectedObject: { ref: model } });
  }
}

function SceneEditorRenderer({ model, isEditing }: SceneComponentProps<SceneEditManager>) {
  // const { selectedObject } = model.useState();
  const styles = useStyles2(getStyles);

  if (!isEditing) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.heading}>Editor</div>
      <div className={styles.tree}></div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexGrow: 0,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      width: theme.spacing(40),
      cursor: 'pointer',
      flexDirection: 'column',
    }),
    heading: css({
      padding: 8,
      fontWeight: 500,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    tree: css({}),
  };
};
