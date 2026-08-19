import { css, keyframes } from '@emotion/css';
import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';
import { useMeasure } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { MUTE_THRESHOLD, PIXELS_PER_LEVEL } from '../constants';
import {
  type ClickedItemData,
  type ColorScheme,
  type ColorSchemeDiff,
  type PaneView,
  type ViewMode,
  type TextAlign,
} from '../types';

import FlameGraphContextMenu, { type GetExtraContextMenuButtonsFunction } from './FlameGraphContextMenu';
import FlameGraphTooltip from './FlameGraphTooltip';
import { type CollapsedMap, type FlameGraphDataContainer, type LevelItem } from './dataTransform';
import { getBarX, useFlameRender } from './rendering';

type Props = {
  data: FlameGraphDataContainer;
  rangeMin: number;
  rangeMax: number;
  matchedLabels: Set<string> | undefined;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
  style?: React.CSSProperties;
  onItemFocused: (data: ClickedItemData) => void;
  focusedItemData?: ClickedItemData;
  textAlign: TextAlign;
  onSandwich: (label: string) => void;
  colorScheme: ColorScheme | ColorSchemeDiff;

  root: LevelItem;
  direction: 'children' | 'parents';
  // Depth in number of levels
  depth: number;

  totalProfileTicks: number;
  totalProfileTicksRight?: number;
  totalViewTicks: number;
  showFlameGraphOnly?: boolean;

  collapsedMap: CollapsedMap;
  setCollapsedMap: (collapsedMap: CollapsedMap) => void;
  collapsing?: boolean;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;

  viewMode: ViewMode;
  paneView: PaneView;
  search: string;
  loadingItems?: Set<LevelItem>;
};

const FlameGraphCanvas = ({
  data,
  rangeMin,
  rangeMax,
  matchedLabels,
  setRangeMin,
  setRangeMax,
  onItemFocused,
  focusedItemData,
  textAlign,
  onSandwich,
  colorScheme,
  totalProfileTicks,
  totalProfileTicksRight,
  totalViewTicks,
  root,
  direction,
  depth,
  showFlameGraphOnly,
  collapsedMap,
  setCollapsedMap,
  collapsing,
  getExtraContextMenuButtons,
  viewMode,
  paneView,
  search,
  loadingItems,
}: Props) => {
  const styles = useStyles2(getStyles);

  const [sizeRef, { width: wrapperWidth }] = useMeasure<HTMLDivElement>();
  const graphRef = useRef<HTMLCanvasElement>(null);
  const [tooltipItem, setTooltipItem] = useState<LevelItem>();

  const [clickedItemData, setClickedItemData] = useState<ClickedItemData>();

  useFlameRender({
    canvasRef: graphRef,
    colorScheme,
    data,
    focusedItemData,
    root,
    direction,
    depth,
    rangeMax,
    rangeMin,
    matchedLabels,
    textAlign,
    totalViewTicks,
    // We need this so that if we have a diff profile and are in sandwich view we still show the same diff colors.
    totalColorTicks: data.isDiffFlamegraph() ? totalProfileTicks : totalViewTicks,
    totalTicksRight: totalProfileTicksRight,
    wrapperWidth,
    collapsedMap,
  });

  const onGraphClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      setTooltipItem(undefined);
      const pixelsPerTick = graphRef.current!.clientWidth / totalViewTicks / (rangeMax - rangeMin);
      const item = convertPixelCoordinatesToBarCoordinates(
        { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        root,
        direction,
        depth,
        pixelsPerTick,
        totalViewTicks,
        rangeMin,
        collapsedMap
      );

      // if clicking on a block in the canvas
      if (item) {
        setClickedItemData({
          posY: e.clientY,
          posX: e.clientX,
          item,
          label: data.getLabel(item.itemIndexes[0]),
        });
      } else {
        // if clicking on the canvas but there is no block beneath the cursor
        setClickedItemData(undefined);
      }
    },
    [data, rangeMin, rangeMax, totalViewTicks, root, direction, depth, collapsedMap]
  );

  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>();
  const onGraphMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (clickedItemData === undefined) {
        setTooltipItem(undefined);
        setMousePosition(undefined);
        const pixelsPerTick = graphRef.current!.clientWidth / totalViewTicks / (rangeMax - rangeMin);
        const item = convertPixelCoordinatesToBarCoordinates(
          { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
          root,
          direction,
          depth,
          pixelsPerTick,
          totalViewTicks,
          rangeMin,
          collapsedMap
        );

        if (item) {
          setMousePosition({ x: e.clientX, y: e.clientY });
          setTooltipItem(item);
        }
      }
    },
    [rangeMin, rangeMax, totalViewTicks, clickedItemData, setMousePosition, root, direction, depth, collapsedMap]
  );

  const onGraphMouseLeave = useCallback(() => {
    setTooltipItem(undefined);
  }, []);

  // hide context menu if outside the flame graph canvas is clicked
  // Overlays marking the nodes whose data is still loading. Uses the same coordinate math as the pixel-to-bar hit test
  // below, so the overlays line up with the rendered bars, including collapsed levels.
  // The canvas is drawn in device pixels but scaled to PIXELS_PER_LEVEL CSS pixels per level, which is also what
  // the pixel to bar hit test below assumes.
  const levelHeight = PIXELS_PER_LEVEL;
  const loadingMarkers = useMemo(() => {
    if (!loadingItems?.size || direction !== 'children' || !wrapperWidth || !totalViewTicks) {
      return [];
    }

    const pixelsPerTick = wrapperWidth / totalViewTicks / (rangeMax - rangeMin);
    const markers: Array<{ key: string; left: number; top: number; width: number }> = [];

    for (const item of loadingItems) {
      let left = getBarX(item.start, totalViewTicks, rangeMin, pixelsPerTick);
      let width = item.value * pixelsPerTick;

      if (left < 0) {
        width += left;
        left = 0;
      }

      width = Math.min(width, wrapperWidth - left);

      // Never mark a bar the flame graph draws as a muted sliver: the host decides what to load from its own idea of
      // the layout, and only the renderer knows what actually ended up on screen.
      if (width <= MUTE_THRESHOLD || left > wrapperWidth) {
        continue;
      }

      // Collapsed groups are drawn as a single level, so count the levels that are actually rendered.
      let level = 0;
      let current: LevelItem | undefined = item;

      while (current && current.level > 0) {
        const collapsedConfig = collapsedMap.get(current);

        if (!collapsedConfig || !collapsedConfig.collapsed || collapsedConfig.items[0] === current) {
          level++;
        }

        current = current.parents?.[0];
      }

      markers.push({ key: `${item.level}-${item.start}`, left, top: level * levelHeight + 1, width });
    }

    return markers;
  }, [loadingItems, direction, wrapperWidth, totalViewTicks, rangeMin, rangeMax, collapsedMap, levelHeight]);

  useEffect(() => {
    const handleOnClick = (e: MouseEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.parentElement?.id !== 'flameGraphCanvasContainer_clickOutsideCheck'
      ) {
        setClickedItemData(undefined);
      }
    };
    window.addEventListener('click', handleOnClick);
    return () => window.removeEventListener('click', handleOnClick);
  }, [setClickedItemData]);

  return (
    <div className={styles.graph}>
      <div className={styles.canvasWrapper} id="flameGraphCanvasContainer_clickOutsideCheck" ref={sizeRef}>
        <canvas
          ref={graphRef}
          data-testid="flameGraph"
          onClick={onGraphClick}
          onMouseMove={onGraphMouseMove}
          onMouseLeave={onGraphMouseLeave}
        />
        {loadingMarkers.map((marker) => (
          <div
            key={marker.key}
            data-testid="flameGraphLoadingMarker"
            className={styles.loadingMarker}
            style={{ left: marker.left, top: marker.top, width: marker.width, height: levelHeight - 2 }}
          />
        ))}
      </div>
      <FlameGraphTooltip
        position={mousePosition}
        item={tooltipItem}
        data={data}
        totalTicks={totalViewTicks}
        collapseConfig={tooltipItem ? collapsedMap.get(tooltipItem) : undefined}
      />
      {!showFlameGraphOnly && clickedItemData && (
        <FlameGraphContextMenu
          data={data}
          itemData={clickedItemData}
          collapsing={collapsing}
          collapseConfig={collapsedMap.get(clickedItemData.item)}
          onMenuItemClick={() => {
            setClickedItemData(undefined);
          }}
          onItemFocus={() => {
            setRangeMin(clickedItemData.item.start / totalViewTicks);
            setRangeMax((clickedItemData.item.start + clickedItemData.item.value) / totalViewTicks);
            onItemFocused(clickedItemData);
          }}
          onSandwich={() => {
            onSandwich(data.getLabel(clickedItemData.item.itemIndexes[0]));
          }}
          onExpandGroup={() => {
            setCollapsedMap(collapsedMap.setCollapsedStatus(clickedItemData.item, false));
          }}
          onCollapseGroup={() => {
            setCollapsedMap(collapsedMap.setCollapsedStatus(clickedItemData.item, true));
          }}
          onExpandAllGroups={() => {
            setCollapsedMap(collapsedMap.setAllCollapsedStatus(false));
          }}
          onCollapseAllGroups={() => {
            setCollapsedMap(collapsedMap.setAllCollapsedStatus(true));
          }}
          allGroupsCollapsed={Array.from(collapsedMap.values()).every((i) => i.collapsed)}
          allGroupsExpanded={Array.from(collapsedMap.values()).every((i) => !i.collapsed)}
          getExtraContextMenuButtons={getExtraContextMenuButtons}
          viewMode={viewMode}
          paneView={paneView}
          search={search}
        />
      )}
    </div>
  );
};

const shimmer = keyframes({
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
});

const getStyles = (theme: GrafanaTheme2) => ({
  graph: css({
    label: 'graph',
    overflow: 'auto',
    flexGrow: 1,
    flexBasis: '50%',
  }),
  canvasContainer: css({
    label: 'canvasContainer',
    display: 'flex',
  }),
  canvasWrapper: css({
    label: 'canvasWrapper',
    cursor: 'pointer',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  }),
  // An outline marks the bar as loading even when the sweep is off screen or animation is disabled; the sweep itself
  // stays faint so the bar underneath, and its label, remain readable.
  loadingMarker: css({
    label: 'loadingMarker',
    position: 'absolute',
    pointerEvents: 'none',
    borderRadius: theme.shape.radius.default,
    outline: `1px dashed ${theme.colors.text.secondary}`,
    outlineOffset: '-1px',
    backgroundImage: `linear-gradient(90deg, transparent 35%, ${
      theme.isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.5)'
    } 50%, transparent 65%)`,
    backgroundSize: '200% 100%',
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${shimmer} 1.2s linear infinite`,
    },
  }),
  sandwichMarker: css({
    label: 'sandwichMarker',
    writingMode: 'vertical-lr',
    transform: 'rotate(180deg)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  }),
  sandwichMarkerIcon: css({
    label: 'sandwichMarkerIcon',
    verticalAlign: 'baseline',
  }),
});

export const convertPixelCoordinatesToBarCoordinates = (
  // position relative to the start of the graph
  pos: { x: number; y: number },
  root: LevelItem,
  direction: 'children' | 'parents',
  depth: number,
  pixelsPerTick: number,
  totalTicks: number,
  rangeMin: number,
  collapsedMap: CollapsedMap
): LevelItem | undefined => {
  let next: LevelItem | undefined = root;
  let currentLevel = direction === 'children' ? 0 : depth - 1;
  const levelIndex = Math.floor(pos.y / PIXELS_PER_LEVEL);
  let found = undefined;

  while (next) {
    const node: LevelItem = next;
    next = undefined;
    if (currentLevel === levelIndex) {
      found = node;
      break;
    }

    const nextList = direction === 'children' ? node.children : node.parents || [];

    for (const child of nextList) {
      const xStart = getBarX(child.start, totalTicks, rangeMin, pixelsPerTick);
      const xEnd = getBarX(child.start + child.value, totalTicks, rangeMin, pixelsPerTick);
      if (xStart <= pos.x && pos.x < xEnd) {
        next = child;
        // Check if item is a collapsed item. if so also check if the item is the first collapsed item in the chain,
        // which we render, or a child which we don't render. If it's a child in the chain then don't increase the
        // level end effectively skip it.
        const collapsedConfig = collapsedMap.get(child);
        if (!collapsedConfig || !collapsedConfig.collapsed || collapsedConfig.items[0] === child) {
          currentLevel = currentLevel + (direction === 'children' ? 1 : -1);
        }
        break;
      }
    }
  }

  return found;
};

export default FlameGraphCanvas;
