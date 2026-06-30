import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { css } from '@emotion/css';
import { useCallback } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';

import { useStyles2 } from '@grafana/ui';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';

import { WidgetFrame } from './WidgetFrame';
import { mergeItemPositions } from './layout';
import { type HomeWidgetCatalogEntry, type WidgetLayoutItem } from './types';

// WidthProvider measures the container and injects `width`, so the grid is responsive without a manual layout map.
const Grid = WidthProvider(GridLayout);

interface WidgetGridProps {
  items: WidgetLayoutItem[];
  catalog: HomeWidgetCatalogEntry[];
  editing: boolean;
  onChange: (items: WidgetLayoutItem[]) => void;
  onRemove: (id: string) => void;
}

export function WidgetGrid({ items, catalog, editing, onChange, onRemove }: WidgetGridProps) {
  const styles = useStyles2(getStyles);

  // Controlled layout derived from persisted items. Items whose id is missing from the catalog
  // (uninstalled plugin / lost permission) are excluded from the grid here but kept in storage below.
  const layout: Layout[] = items.flatMap((item) => {
    const entry = catalog.find((e) => e.id === item.id);
    if (!entry) {
      return [];
    }
    return [{ i: item.id, x: item.x, y: item.y, w: item.w, h: item.h, minW: entry.minSize.w, minH: entry.minSize.h }];
  });

  // Persist only on drag/resize stop. Merge RGL's new positions onto the existing items so ids that
  // were excluded from the layout above survive untouched rather than being dropped from storage.
  const handleStop = useCallback(
    (rglLayout: Layout[]) => {
      onChange(mergeItemPositions(items, rglLayout));
    },
    [items, onChange]
  );

  return (
    <Grid
      className={styles.grid}
      layout={layout}
      cols={GRID_COLUMN_COUNT}
      rowHeight={GRID_CELL_HEIGHT}
      margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
      isDraggable={editing}
      isResizable={editing}
      draggableHandle=".home-widget-drag-handle"
      onDragStop={handleStop}
      onResizeStop={handleStop}
    >
      {items.map((item) => {
        const entry = catalog.find((e) => e.id === item.id);
        if (!entry) {
          // Skip rendering unknown ids; handleStop's merge keeps them in storage.
          return null;
        }
        return (
          <div key={item.id}>
            <WidgetFrame id={item.id} editing={editing} onRemove={onRemove}>
              {entry.render()}
            </WidgetFrame>
          </div>
        );
      })}
    </Grid>
  );
}

const getStyles = () => ({
  grid: css({
    position: 'relative',
  }),
});
