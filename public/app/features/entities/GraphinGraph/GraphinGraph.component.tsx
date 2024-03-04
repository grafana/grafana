import { Graph, GraphOptions, LayoutConfig } from '@antv/g6';
import React, { useEffect, useCallback, useRef, memo, useState } from 'react';

import G6GraphWrapper from '../G6GraphWrapper/G6GraphWrapper.component';
import { GraphCustomData } from '../asserts-types';

import './components/DashEdge';
import { MIN_ZOOM, MAX_ZOOM } from './constants';
import useDisplayConfig from './hooks/useDisplayConfig';

import { G6GraphEvent } from '@antv/g6-pc';

interface Props {
  data: GraphCustomData;
  layout: LayoutConfig;
  onRef?: (ref: Graph) => void;
  showConnectedItemsInContextMenu?: boolean;
  lastUpdateTime?: number;
  fitView?: boolean;
  options?: Partial<GraphOptions>;
  disableZoom?: boolean;
  // afterLayoutConfig is used for setting after layout options
  // initial layout options are used for quick render of needed layout but they are pretty aggressive
  // and can't be used for user interactions
  afterLayoutConfig?: LayoutConfig;
  onNodeClick: (id: string) => void;
}

export const setTooltipDisplay = (show: boolean) => {
  if (show) {
    document.body.classList.remove('hide-graph-tooltip');
  } else {
    document.body.classList.add('hide-graph-tooltip');
  }
};

const GraphinGraph = ({
  data,
  onRef,
  layout,
  lastUpdateTime,
  fitView,
  options,
  disableZoom,
  afterLayoutConfig,
  onNodeClick,
}: Props) => {
  const graphRef = useRef<Graph | null>(null);
  const [buildingLayout, setBuildingLayout] = useState(true);

  const defaultOptions: Partial<GraphOptions> = {
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    modes: {
      default: ['drag-canvas', 'drag-node'],
    },
    plugins: [],
  };

  if (!disableZoom) {
    defaultOptions.modes?.default?.push('zoom-canvas');
  }

  const handleDragStart = useCallback(() => {
    setTooltipDisplay(false);
  }, []);

  const handleDragEnd = useCallback(() => setTooltipDisplay(true), []);

  const handleAfterLayout = useCallback(() => {
    if (graphRef.current?.get('layout').clustering) {
      graphRef.current?.updateLayout({
        workerEnabled: false,
        clustering: false,
        nodeStrength: 30,
        edgeStrength: 0.1,
        linkDistance: 50,
        collideStrength: 0.8,
        ...(afterLayoutConfig || {}),
      });
      setTimeout(() => {
        setBuildingLayout(false);
        if (data.nodes.length > 15 || fitView) {
          graphRef.current?.fitView();
        }
      }, 200);
    }
  }, [graphRef, data, fitView, afterLayoutConfig]);

  const handleContextMenu = useCallback(
    (e: G6GraphEvent) => {
      if (!graphRef.current) {
        return;
      }
      e.preventDefault();
      onNodeClick(e.item.getID());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphRef.current, onNodeClick]
  );

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }
    onRef && onRef(graphRef.current);
    const graph: Graph = graphRef.current;

    graph?.on('node:click', handleContextMenu);
    graph?.on('node:mousedown', handleDragStart);
    graph?.on('node:dragend', handleDragEnd);
    graph?.on('afterlayout', handleAfterLayout);
    return () => {
      graph?.off('node:click', handleContextMenu);
      graph?.off('node:dragend', handleDragEnd);
      graph?.off('afterlayout', handleAfterLayout);
      graph?.off('node:mousedown', handleDragStart);
    };
    //eslint-disable-next-line
  }, [handleContextMenu]);

  const dataWithDisplayConfig = useDisplayConfig({
    data,
    showLabels: true,
    lastUpdateTime,
  });

  return (
    <>
      {buildingLayout && <div>Building layout...</div>}
      <G6GraphWrapper
        style={{ visibility: buildingLayout ? 'hidden' : 'visible' }}
        ref={(c) => {
          c && (graphRef.current = c);
        }}
        layout={layout}
        data={dataWithDisplayConfig}
        options={{ ...defaultOptions, ...options }}
      />
    </>
  );
};

export default memo(GraphinGraph);
