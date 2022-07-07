import { css } from '@emotion/css';
import React, { CSSProperties } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SceneObject } from '../core/types';

export function SceneComponentEditingWrapper<T extends SceneObject>({
  model,
  children,
}: {
  model: T;
  children: React.ReactNode;
}) {
  const styles = useStyles2(getStyles);
  const editor = model.getSceneEditor();
  const { hoverObject, selectedObject } = editor.useState();

  const onMouseEnter = () => editor.onMouseEnterObject(model);
  const onMouseLeave = () => editor.onMouseLeaveObject(model);

  const onClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    editor.onSelectObject(model);
  };

  const style: CSSProperties = {};
  let className = styles.wrapper;

  if (hoverObject?.ref === model) {
    className += ' ' + styles.hover;
  }
  if (selectedObject?.ref === model) {
    className += ' ' + styles.selected;
  }

  return (
    <div style={style} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
      {children}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      flexGrow: 1,
      padding: 8,
      border: `1px dashed ${theme.colors.primary.main}`,
      cursor: 'pointer',
    }),
    hover: css({
      border: `1px solid ${theme.colors.primary.border}`,
    }),
    selected: css({
      border: `1px solid ${theme.colors.error.border}`,
    }),
  };
};
