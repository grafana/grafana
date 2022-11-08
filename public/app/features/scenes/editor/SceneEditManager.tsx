import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneEditorState, SceneEditor, SceneObject, SceneComponentProps, SceneComponent } from '../core/types';

import { SceneObjectEditor } from './SceneObjectEditor';
import { SceneObjectTree } from './SceneObjectTree';

export class SceneEditManager extends SceneObjectBase<SceneEditorState> implements SceneEditor {
  public static Component = SceneEditorRenderer;

  public get Component(): SceneComponent<this> {
    return SceneEditorRenderer;
  }

  public onMouseEnterObject(model: SceneObject) {
    this.setState({ hoverObject: { ref: model } });
  }

  public onMouseLeaveObject(model: SceneObject) {
    if (model.parent) {
      this.setState({ hoverObject: { ref: model.parent } });
    } else {
      this.setState({ hoverObject: undefined });
    }
  }

  public onSelectObject(model: SceneObject) {
    this.setState({ selectedObject: { ref: model } });
  }
}

function SceneEditorRenderer({ model, isEditing }: SceneComponentProps<SceneEditManager>) {
  const { selectedObject } = model.useState();
  const styles = useStyles2(getStyles);

  if (!isEditing) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.tree}>
        <SceneObjectTree node={model.parent!} selectedObject={selectedObject?.ref} />
      </div>
      {selectedObject && <SceneObjectEditor model={selectedObject.ref} />}
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
    tree: css({
      padding: theme.spacing(0.25, 1),
    }),
  };
};
