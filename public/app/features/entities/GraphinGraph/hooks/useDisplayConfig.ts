import G6 from '@antv/g6';

import { useTheme2 } from '@grafana/ui';

import { formatLongNumber } from '../../ValueFormat.helper';
import { GraphCustomData, GraphCustomEdge, GraphCustomNode } from '../../asserts-types';
import { ENTITY_OUT_OF_DATE_TIME, OUT_OF_DATE_COLOR } from '../../constants';

interface Props {
  data: GraphCustomData;
  showLabels: boolean;
  lastUpdateTime: number | undefined;
}

export default function ({ data, showLabels, lastUpdateTime }: Props) {
  const theme = useTheme2();

  const showNodeNames = true;
  const showRelationships = true;

  const nodes: GraphCustomNode[] = data.nodes.map((node) => {
    const nodeUpdated = typeof node.properties.Updated !== 'undefined' ? +node.properties?.Updated : 0;

    const isOutOfDate = lastUpdateTime && lastUpdateTime - nodeUpdated > ENTITY_OUT_OF_DATE_TIME;

    return {
      ...node,
      type: 'asserts-node',
      assertion: node.assertion,
      connectedAssertion: node.connectedAssertion,
      showLabels: showNodeNames ? showLabels : false,
      style: {
        fill: isOutOfDate ? OUT_OF_DATE_COLOR : '#0000FF',
        fontColor: theme.isLight ? '#666666' : '#d0d3d8',
        activeBgStroke: theme.isLight ? '#f4f7fc' : '#56595e',
      },
    };
  });

  const edges = data.edges.map((edge) => {
    let edgeColor = '#000000';

    if (edge.disabled) {
      edgeColor = theme.isLight ? 'rgba(242, 242, 242, 1)' : 'rgba(80, 80, 80, 1)';
    }
    if (!edgeColor) {
      edgeColor = theme.colors.text.primary;
    }

    const cpmLabel =
      edge.callsPerMinute && showLabels ? `${formatLongNumber(edge.callsPerMinute)} calls/min` : undefined;

    const edgeLabel = showRelationships && showLabels ? edge.label : '';

    return {
      ...edge,
      label: cpmLabel || edgeLabel,
      type: edge.disabled
        ? 'LineEdge'
        : showRelationships && showLabels && edge.label === 'CALLS'
          ? 'DashEdge'
          : 'LineEdge',
      labelCfg: {
        autoRotate: true,
        refY: 10,
        style: {
          fill: edge.disabled
            ? theme.isLight
              ? 'rgba(242, 242, 242,1)'
              : 'rgba(80, 80, 80,1)'
            : theme.colors.text.disabled,
        },
      },
      style: {
        ...edge.style,
        endArrow:
          edge.style?.endArrow !== undefined
            ? edge.style?.endArrow
            : {
                path: G6.Arrow.triangle(5, 7, 0),
                fill: edgeColor,
              },
        stroke: edgeColor,
        width: 1,
      },
    } as GraphCustomEdge;
  });
  return { nodes, edges } as GraphCustomData;
}
