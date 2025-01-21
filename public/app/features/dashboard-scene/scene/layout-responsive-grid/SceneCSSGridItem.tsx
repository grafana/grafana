import { css } from '@emotion/css';
import { CSSProperties } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

export interface SceneCSSGridItemPlacement {
  /**
   * True when the item should rendered but not visible.
   * Useful for conditional display of layout items
   */
  isHidden?: boolean;
  /**
   * Useful for making content span across multiple rows or columns
   */
  gridColumn?: CSSProperties['gridColumn'];
  gridRow?: CSSProperties['gridRow'];
}

export interface SceneCSSGridItemState extends SceneCSSGridItemPlacement, SceneObjectState {
  body?: SceneObject;
}

export interface SceneCSSGridItemRenderProps<T> extends SceneComponentProps<T> {
  parentState?: SceneCSSGridItemPlacement;
}

export class SceneCSSGridItem extends SceneObjectBase<SceneCSSGridItemState> {
  public static Component = SceneCSSGridItemRenderer;
}

function SceneCSSGridItemRenderer({ model, parentState }: SceneCSSGridItemRenderProps<SceneCSSGridItem>) {
  if (!parentState) {
    throw new Error('SceneCSSGridItem must be a child of SceneCSSGridLayout');
  }

  const { body, isHidden } = model.useState();
  const styles = useStyles2(getStyles, model.state);

  if (!body || isHidden) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <body.Component model={body} />
    </div>
  );
}

const getStyles = (_theme: GrafanaTheme2, state: SceneCSSGridItemState) => ({
  wrapper: css({
    gridColumn: state.gridColumn || 'unset',
    gridRow: state.gridRow || 'unset',
    position: 'relative', // Needed for VizPanel
  }),
});
