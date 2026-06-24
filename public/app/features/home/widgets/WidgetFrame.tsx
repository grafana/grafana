import { css, cx } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

interface WidgetFrameProps {
  id: string;
  editing: boolean;
  onRemove: (id: string) => void;
  children: ReactNode;
}

/**
 * Wraps a single grid child. In view mode it renders the widget's card untouched; in edit mode it
 * overlays a top-right toolbar with the RGL drag handle and a remove action. It never adds its own
 * HomeSection — the catalog entry already renders one, so a second wrapper would double the card.
 */
export function WidgetFrame({ id, editing, onRemove, children }: WidgetFrameProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.frame}>
      {editing && (
        <div className={styles.toolbar}>
          <Stack direction="row" gap={0.5}>
            {/* The literal `home-widget-drag-handle` class is RGL's draggableHandle selector. */}
            <span className={cx('home-widget-drag-handle', styles.dragHandle)}>
              <Icon name="draggabledots" />
            </span>
            <IconButton
              name="trash-alt"
              variant="destructive"
              tooltip={t('home.widgets.frame.remove', 'Remove widget')}
              onClick={() => onRemove(id)}
            />
          </Stack>
        </div>
      )}
      {children}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  frame: css({
    height: '100%',
    position: 'relative',
    overflow: 'auto',
    // Stretch the rendered card to fill the grid cell rather than collapsing to content height.
    '& > :last-child': {
      minHeight: '100%',
    },
  }),
  toolbar: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: 1,
  }),
  dragHandle: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: theme.spacing(0.5),
    cursor: 'grab',
  }),
});
