import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { SceneObject, SceneLayoutState, SceneObjectList, isSceneObject } from '../models/types';

export interface Props {
  node: SceneObject;
  selectedObject?: SceneObject;
}

export function SceneObjectTree({ node, selectedObject }: Props) {
  const styles = useStyles2(getStyles);
  const state = node.useState();
  let children: SceneObjectList = [];

  for (const propKey of Object.keys(state)) {
    const propValue = (state as any)[propKey];
    if (isSceneObject(propValue)) {
      children.push(propValue);
    }
  }

  let layoutChildren = (state as SceneLayoutState).children;
  if (layoutChildren) {
    for (const child of layoutChildren) {
      children.push(child);
    }
  }

  const name = node.constructor.name;

  return (
    <div className={styles.node}>
      <div className={styles.header}>
        <div className={styles.icon}>{children.length > 0 && <Icon name="arrow-down" size="sm" />}</div>
        <div className={styles.name}>{name}</div>
      </div>
      {children.length > 0 && (
        <div className={styles.children}>
          {children.map((child) => (
            <SceneObjectTree node={child} selectedObject={selectedObject} key={child.state.key} />
          ))}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    node: css({
      display: 'flex',
      flexGrow: 0,
      cursor: 'pointer',
      flexDirection: 'column',
      padding: '2px 8px',
    }),
    header: css({
      display: 'flex',
      fontWeight: 500,
    }),
    name: css({}),
    icon: css({
      width: theme.spacing(3),
    }),
    children: css({
      display: 'flex',
      flexDirection: 'column',
      paddingLeft: 8,
    }),
  };
};
