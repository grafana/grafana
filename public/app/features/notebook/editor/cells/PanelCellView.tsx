import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { rangeUtil, type DataQuery, type GrafanaTheme2, type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  SceneTimeRange,
  sceneGraph,
  type VizPanel,
} from '@grafana/scenes';
import { type PanelKind } from '@grafana/schema/apis/notebook/v2beta1';
import { useStyles2 } from '@grafana/ui';
import { getExploreUrl } from 'app/core/utils/explore';

import { buildNotebookVizPanel } from './buildNotebookVizPanel';

export const DEFAULT_PANEL_HEIGHT = 320;
const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 1200;

interface Props {
  panel: PanelKind;
  timeFrom: string;
  timeTo: string;
  /** Bump to re-run the queries with the same time range. */
  refreshNonce?: number;
  /** Rendered height in pixels; falls back to the default when unset. */
  height?: number;
  /** Called with the final height when the user finishes a resize drag. */
  onHeightChange?: (height: number) => void;
  /** Exposes a reader for the panel's latest query result (used by viz suggestions). */
  onDataReaderReady?: (getData: () => PanelData | undefined) => void;
}

/**
 * Renders one notebook panel element as a self-contained embedded scene with a
 * bottom-edge resize handle. Each cell gets its own scene so cells can be
 * added/removed/reordered independently; the notebook-level time range is pushed
 * down into every cell's SceneTimeRange.
 */
export function PanelCellView({
  panel,
  timeFrom,
  timeTo,
  refreshNonce,
  height,
  onHeightChange,
  onDataReaderReady,
}: Props) {
  const styles = useStyles2(getStyles);

  // Live height during a resize drag; the committed value comes from props.
  const [draggingHeight, setDraggingHeight] = useState<number | undefined>();
  const dragState = useRef<{ startY: number; startHeight: number } | undefined>(undefined);
  const vizPanelRef = useRef<VizPanel | undefined>(undefined);

  // Rebuild the scene only when the panel definition itself changes.
  const panelJson = JSON.stringify(panel);

  const scene = useMemo(() => {
    const parsed: PanelKind = JSON.parse(panelJson);
    const vizPanel = buildNotebookVizPanel(parsed);
    vizPanelRef.current = vizPanel;
    return new EmbeddedScene({
      $timeRange: new SceneTimeRange({ from: timeFrom, to: timeTo }),
      body: new SceneFlexLayout({
        direction: 'column',
        children: [new SceneFlexItem({ height: '100%', body: vizPanel })],
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- time range changes are synced onto the existing scene below
  }, [panelJson]);

  useEffect(() => {
    onDataReaderReady?.(() => {
      const vizPanel = vizPanelRef.current;
      return vizPanel ? sceneGraph.getData(vizPanel).state.data : undefined;
    });
  }, [scene, onDataReaderReady]);

  useEffect(() => {
    const timeRange = scene.state.$timeRange;
    if (!timeRange) {
      return;
    }
    if (timeRange.state.from !== timeFrom || timeRange.state.to !== timeTo) {
      timeRange.onTimeRangeChange(rangeUtil.convertRawToRange({ from: timeFrom, to: timeTo }));
    }
  }, [scene, timeFrom, timeTo]);

  useEffect(() => {
    if (refreshNonce) {
      scene.state.$timeRange?.onRefresh();
    }
  }, [scene, refreshNonce]);

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      if (!onHeightChange) {
        return;
      }
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragState.current = { startY: e.clientY, startHeight: height ?? DEFAULT_PANEL_HEIGHT };
    },
    [onHeightChange, height]
  );

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) {
      return;
    }
    const next = dragState.current.startHeight + (e.clientY - dragState.current.startY);
    setDraggingHeight(Math.min(Math.max(next, MIN_PANEL_HEIGHT), MAX_PANEL_HEIGHT));
  }, []);

  const onResizeEnd = useCallback(() => {
    if (dragState.current === undefined) {
      return;
    }
    dragState.current = undefined;
    setDraggingHeight((finalHeight) => {
      if (finalHeight !== undefined) {
        onHeightChange?.(finalHeight);
      }
      return undefined;
    });
  }, [onHeightChange]);

  const renderedHeight = draggingHeight ?? height ?? DEFAULT_PANEL_HEIGHT;

  return (
    <div className={styles.wrapper}>
      <div style={{ height: renderedHeight }}>
        <scene.Component model={scene} />
      </div>
      {onHeightChange && (
        <div
          className={styles.resizeHandle}
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('notebooks.panel-cell.resize', 'Resize panel')}
          data-testid="notebook-panel-resize"
        >
          <div className={styles.resizeGrip} />
        </div>
      )}
    </div>
  );
}

/** Converts a notebook panel's queries back to the legacy shape Explore understands. */
export function panelToExploreQueries(panel: PanelKind): DataQuery[] {
  return panel.spec.data.spec.queries.map((query) => ({
    refId: query.spec.refId,
    ...query.spec.query.spec,
    datasource: {
      type: query.spec.query.group,
      uid: query.spec.query.datasource?.name,
    },
  }));
}

/** Builds an Explore URL for a notebook panel using the notebook's time range. */
export async function getExploreUrlForPanel(
  panel: PanelKind,
  timeFrom: string,
  timeTo: string
): Promise<string | undefined> {
  const queries = panelToExploreQueries(panel);
  if (queries.length === 0) {
    return undefined;
  }
  return getExploreUrl({
    queries,
    dsRef: queries[0].datasource,
    timeRange: rangeUtil.convertRawToRange({ from: timeFrom, to: timeTo }),
    scopedVars: undefined,
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
  }),
  resizeHandle: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: theme.spacing(1.5),
    cursor: 'ns-resize',
    touchAction: 'none',

    '&:hover > div, &:active > div': {
      background: theme.colors.primary.border,
    },
  }),
  resizeGrip: css({
    width: theme.spacing(6),
    height: 4,
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.border.medium,
  }),
});
