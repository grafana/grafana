import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { sceneGraph } from '../../core/sceneGraph';
import { SceneComponentProps, SceneLayoutChildState, SceneObject, SceneObjectUrlValues } from '../../core/types';
import { SceneObjectUrlSyncConfig } from '../../services/SceneObjectUrlSyncConfig';
import { SceneDragHandle } from '../SceneDragHandle';

import { SceneGridLayout } from './SceneGridLayout';

export interface SceneGridRowState extends SceneLayoutChildState {
  title: string;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  children: Array<SceneObject<SceneLayoutChildState>>;
}

export class SceneGridRow extends SceneObjectBase<SceneGridRowState> {
  public static Component = SceneGridRowRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['rowc'] });

  public constructor(state: SceneGridRowState) {
    super({
      isCollapsible: true,
      ...state,
      layout: {
        isResizable: false,
        isDraggable: true,
        ...state.layout,
        x: 0,
        height: 1,
        width: GRID_COLUMN_COUNT,
      },
    });
  }

  public onCollapseToggle = () => {
    if (!this.state.isCollapsible) {
      return;
    }

    const layout = this.parent;

    if (!layout || !(layout instanceof SceneGridLayout)) {
      throw new Error('SceneGridRow must be a child of SceneGridLayout');
    }

    layout.toggleRow(this);
  };

  public getUrlState(state: SceneGridRowState) {
    return { rowc: state.isCollapsed ? '1' : '0' };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const isCollapsed = values.rowc === '1';
    if (isCollapsed !== this.state.isCollapsed) {
      this.onCollapseToggle();
    }
  }
}

export function SceneGridRowRenderer({ model }: SceneComponentProps<SceneGridRow>) {
  const styles = useStyles2(getSceneGridRowStyles);
  const { isCollapsible, isCollapsed, isDraggable, title } = model.useState();
  const layout = sceneGraph.getLayout(model);
  const dragHandle = <SceneDragHandle layoutKey={layout.state.key!} />;

  return (
    <div className={styles.row}>
      <div className={cx(styles.rowHeader, isCollapsed && styles.rowHeaderCollapsed)}>
        <div onClick={model.onCollapseToggle} className={styles.rowTitleWrapper}>
          {isCollapsible && <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />}
          <span className={styles.rowTitle}>{title}</span>
        </div>
        {isDraggable && isCollapsed && <div>{dragHandle}</div>}
      </div>
    </div>
  );
}

const getSceneGridRowStyles = (theme: GrafanaTheme2) => {
  return {
    row: css({
      width: '100%',
      height: '100%',
      position: 'relative',
      zIndex: 0,
      display: 'flex',
      flexDirection: 'column',
    }),
    rowHeader: css({
      width: '100%',
      height: '30px',
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '8px',
      border: `1px solid transparent`,
    }),
    rowTitleWrapper: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
    }),
    rowHeaderCollapsed: css({
      marginBottom: '0px',
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.borderRadius(1),
    }),
    rowTitle: css({
      fontSize: theme.typography.h6.fontSize,
      fontWeight: theme.typography.h6.fontWeight,
    }),
  };
};
