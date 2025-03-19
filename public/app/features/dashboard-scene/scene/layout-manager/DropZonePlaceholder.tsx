import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Portal, useStyles2 } from '@grafana/ui';

interface DropZonePlaceholderState extends SceneObjectState {
  width: number;
  height: number;
  top: number;
  left: number;
}

export class DropZonePlaceholder extends SceneObjectBase<DropZonePlaceholderState> {
  static Component = ({ model }: SceneComponentProps<DropZonePlaceholder>) => {
    const { width, height, left, top } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <Portal>
        <div
          className={cx(styles.placeholder, {
            [styles.visible]: width > 0 && height > 0,
          })}
          style={{ width, height, transform: `translate(${left}px, ${top}px)` }}
        />
      </Portal>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  placeholder: css({
    visibility: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: -1,
    pointerEvents: 'none',
    background: theme.colors.primary.transparent,
    boxShadow: `0 0 4px ${theme.colors.primary.border}`,
  }),
  visible: css({
    visibility: 'visible',
  }),
});
