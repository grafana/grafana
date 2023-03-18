import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectBase,
  SceneObject,
  SceneComponentProps,
  SceneComponent,
  SceneObjectStatePlain,
  SceneObjectRef,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { SceneComponentEditWrapper } from './SceneComponentEditWrapper';
import { SceneObjectEditor } from './SceneObjectEditor';
import { SceneObjectTree } from './SceneObjectTree';

export interface SceneEditorState extends SceneObjectStatePlain {
  hoverObject?: SceneObjectRef;
  selectedObject?: SceneObjectRef;
  isEditing?: boolean;
}

export interface SceneEditor extends SceneObject<SceneEditorState> {
  onMouseEnterObject(model: SceneObject): void;
  onMouseLeaveObject(model: SceneObject): void;
  onSelectObject(model: SceneObject): void;
  //getEditComponentWrapper(): React.ComponentType<SceneComponentEditWrapperProps>;
}

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

  public getEditComponentWrapper() {
    return SceneComponentEditWrapper;
  }
}

function SceneEditorRenderer({ model }: SceneComponentProps<SceneEditManager>) {
  const { selectedObject } = model.useState();
  const styles = useStyles2(getStyles);

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
