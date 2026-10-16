import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

/**
 * Drag-handle styles shared by the nav rows (MegaMenuItem) and the pinned breadcrumb rows
 * (MegaMenuPinnedItem) so the handle column width, right-nudge and grab affordance stay identical
 * across both. Nav rows reserve the column on every row (handle only on draggable ones) via `column`;
 * pinned rows are always draggable, so they compose `column` and `handle` together.
 */
export const getDragHandleStyles = (theme: GrafanaTheme2) => ({
  // Fixed-width column that reserves the handle slot, right-aligned and pulled in so the handle sits
  // only ~4px from the item icon.
  column: css({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    justifyContent: 'flex-end',
    marginRight: theme.spacing(-0.5),
    width: theme.spacing(2),
  }),
  // The grab affordance itself.
  handle: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    cursor: 'grab',
    display: 'flex',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
});
