import { css } from '@emotion/css';
import React, { CSSProperties } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneComponentProps } from './types';

export function SceneComponentEditWrapper<T extends SceneObjectBase<any>>({
  model,
  isEditing,
}: SceneComponentProps<T>) {
  const Component = (model as any).constructor['Component'] ?? EmptyRenderer;
  const inner = <Component model={model} isEditing={isEditing} />;

  if (!isEditing) {
    return inner;
  }

  return <SceneComponentEditingWrapper model={model}>{inner}</SceneComponentEditingWrapper>;
}

export function SceneComponentEditingWrapper<T extends SceneObjectBase<any>>({
  model,
  children,
}: {
  model: T;
  children: React.ReactNode;
}) {
  const styles = useStyles2(getStyles);
  const editor = model.getEditor();
  const { hoverObject } = editor.useState();

  const onMouseEnter = () => editor.setState({ hoverObject: { ref: model } });
  const onMouseLeave = () => {
    if (model.parent) {
      editor.setState({ hoverObject: { ref: model.parent } });
    } else {
      editor.setState({ hoverObject: undefined });
    }
  };

  const style: CSSProperties = {};
  let className = styles.wrapper;

  if (hoverObject?.ref === model) {
    className += ' ' + styles.hover;
  }

  return (
    <div style={style} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
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
  };
};

function EmptyRenderer<T>(_: SceneComponentProps<T>): React.ReactElement | null {
  return null;
}
