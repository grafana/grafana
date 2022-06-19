import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SceneComponentProps } from './types';

export function SceneComponentEditWrapper<T>({ model, isEditing }: SceneComponentProps<T>) {
  const styles = useStyles2(getStyles);
  const Component = (model as any).constructor['Component'] ?? EmptyRenderer;

  const inner = <Component model={model} isEditing={isEditing} />;

  if (isEditing) {
    return <div className={styles.wrapper}>{inner}</div>;
  }

  return inner;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      flexGrow: 1,
      padding: 8,
      border: `1px solid ${theme.colors.primary.border}`,
      '&:hover': {
        background: theme.colors.primary.transparent,
      },
    }),
  };
};

function EmptyRenderer<T>(props: SceneComponentProps<T>): React.ReactElement | null {
  return null;
}
