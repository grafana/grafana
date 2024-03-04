/**
 *
 * G6GraphWrapper
 *
 */

import G6, { G6GraphEvent, Graph, GraphOptions, LayoutConfig } from '@antv/g6-pc';
import React, {
  memo,
  useRef,
  useEffect,
  cloneElement,
  Children,
  isValidElement,
  useState,
  ForwardRefRenderFunction,
  forwardRef,
  ReactNode,
  useCallback,
  CSSProperties,
} from 'react';

// import { useIntl } from 'react-intl';
// import messages from './messages';
import { GraphCustomData, GraphCustomNode } from '../asserts-types';

import '../GraphinGraph/components/AssertsNode';
import useResizeObserver from 'use-resize-observer';

import useDidUpdateEffect from './useDidUpdate';

interface IProps {
  data: GraphCustomData;
  layout: LayoutConfig;
  options?: Partial<GraphOptions>;
  children?: ReactNode;
  style?: CSSProperties;
}

const G6GraphWrapper: ForwardRefRenderFunction<Graph, IProps> = (
  { data, options = {}, children, layout, style },
  ref
) => {
  const [graphLoaded, setGraphLoaded] = useState(false);

  const graphRef = useRef<Graph>();
  const containerRef = useRef<HTMLDivElement>(null);

  const initGraph = () => {
    if (!containerRef.current) {
      return;
    }
    graphRef.current = new G6.Graph({
      container: containerRef.current,
      width: containerRef.current.scrollWidth,
      height: containerRef.current.scrollHeight,
      defaultNode: { type: 'asserts-node' },
      layout: {
        ...layout,
        center: [containerRef.current.scrollWidth / 2, containerRef.current.scrollHeight / 2],
      },
      ...options,
    });

    if (typeof ref === 'function') {
      ref(graphRef.current);
    }
    graphRef.current.read(data);
    setGraphLoaded(true);
  };

  const handleDragStart = useCallback((e: G6GraphEvent) => {
    graphRef.current?.layout();
    const model = e.item.get('model');
    model.fx = e.x;
    model.fy = e.y;
  }, []);

  const handleDragging = useCallback((e: G6GraphEvent) => {
    graphRef.current?.layout();
    const model = e.item.get('model');
    model.fx = e.x;
    model.fy = e.y;
  }, []);

  // const handleDragEnd = useCallback((e: G6GraphEvent) => {
  //   graphRef.current?.layout();
  //   e.item.get('model').fx = null;
  //   e.item.get('model').fy = null;
  // }, []);

  const bindEvents = () => {
    if (!graphRef.current) {
      return;
    }

    graphRef.current.off('node:dragstart', handleDragStart);
    graphRef.current.on('node:dragstart', handleDragStart);

    graphRef.current.off('node:drag', handleDragging);
    graphRef.current.on('node:drag', handleDragging);

    // graphRef.current.off('node:dragend', handleDragEnd);
    // graphRef.current.on('node:dragend', handleDragEnd);
  };

  useEffect(() => {
    initGraph();
    bindEvents();
    //eslint-disable-next-line
  }, []);

  useDidUpdateEffect(() => {
    graphRef.current?.updateLayout({ ...layout });
  }, [layout]);

  useDidUpdateEffect(() => {
    data.nodes.forEach((node) => {
      if (node.hidden) {
        graphRef.current?.findById(node.id)?.hide();
      } else {
        graphRef.current?.findById(node.id)?.show();
      }
    });
    data.edges.forEach((edge) => {
      if (!edge.id) {
        return true;
      }
      if (edge.hidden) {
        graphRef.current?.findById(edge.id)?.hide();
      } else {
        graphRef.current?.findById(edge.id)?.show();
      }
    });
    const staleNodes = graphRef.current?.getNodes();
    const staleEdges = graphRef.current?.getEdges();

    // if same data just update it without calling .changeData()
    if (staleNodes && staleEdges) {
      const sameNodes = data.nodes.every((node) => staleNodes.find((item) => item.getModel().id === node.id));
      const sameEdges = data.edges.every((edge) =>
        staleEdges.find(
          (item) =>
            item.getModel().id === edge.id &&
            item.getModel().source === edge.source &&
            item.getModel().target === edge.target
        )
      );
      if (
        sameNodes &&
        staleNodes.length === data.nodes.length &&
        sameEdges &&
        staleEdges.length === data.edges.length
      ) {
        data.nodes.forEach((node) => {
          graphRef.current?.findById(node.id)?.update(node);
        });
        data.edges.forEach((edge) => {
          edge.id && graphRef.current?.findById(edge.id)?.update(edge);
        });
        graphRef.current?.layout();
        return;
      }
    }

    const freshNodesIds = data.nodes
      .filter((node) => !staleNodes?.find((n) => n.getModel().id === node.id))
      .map((n) => n.id);

    // logic to place fresh nodes near active item
    const dataToSet = {
      edges: data.edges,
      nodes: data.nodes.map((node) => {
        if (freshNodesIds.includes(node.id)) {
          const nodeEdge = data.edges.find((e) => e.target === node.id || e.source === node.id);

          const connectedNode = staleNodes
            ?.find((n) => n.getModel().id === nodeEdge?.source || n.getModel().id === nodeEdge?.target)
            ?.getModel() as GraphCustomNode | undefined;
          return { ...node, x: connectedNode?.x, y: connectedNode?.y };
        }
        return node;
      }),
    };

    graphRef.current?.changeData(dataToSet);
  }, [data]);

  useResizeObserver({
    ref: containerRef,
    onResize: ({ width, height }) => {
      if (width && height) {
        graphRef.current?.changeSize(width, height);
      }
    },
  });

  const childrenWithProps = Children.map(children, (child) => {
    if (isValidElement<{ graph: Graph; containerRef: HTMLDivElement | null }>(child)) {
      return cloneElement(child, {
        graph: graphRef.current,
        containerRef: containerRef.current,
      });
    }
    return child;
  });

  return (
    <div ref={containerRef} style={{ width: '100%', minHeight: '200px', ...style }}>
      {graphLoaded && childrenWithProps}
    </div>
  );
};

const forwardedComponent = forwardRef(G6GraphWrapper);

// const propsAreEqual = (
//   prevProps: Readonly<PropsWithChildren<IProps & RefAttributes<Graph>>>,
//   nextProps: Readonly<PropsWithChildren<IProps & RefAttributes<Graph>>>,
// ) => {
//   return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
// };

export default memo(forwardedComponent);
