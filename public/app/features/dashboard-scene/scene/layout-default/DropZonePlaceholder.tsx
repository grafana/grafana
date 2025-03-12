import { css } from '@emotion/css';
import classNames from 'classnames';

import { GrafanaTheme2 } from '@grafana/data';
import { Portal, useStyles2 } from '@grafana/ui';

interface DropZonePlaceholderProps {
  width: number;
  height: number;
  top: number;
  left: number;
}

export const DropZonePlaceholder = ({ width, height, top, left }: DropZonePlaceholderProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Portal>
      <div
        className={classNames(styles.placeholder, {
          [styles.visible]: width > 0 && height > 0,
        })}
        style={{ width, height, transform: `translate(${left}px, ${top}px)` }}
      ></div>
    </Portal>
  );
};

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
