import React, { useCallback, useMemo } from 'react';
import { GraphView } from '@grafana/ui/src/components/ServiceMap/GraphView';
import { DataFrame, TimeRange } from '@grafana/data';
import { ExploreId, StoreState } from '../../types';
import { splitOpen } from './state/main';
import { connect } from 'react-redux';
import { ServiceMapLinkDatum, ServiceMapNodeDatum } from '@grafana/ui';
import { getFieldLinksForExplore } from './utils/links';

interface ServiceMapContainerProps {
  // Edges and Nodes are separate frames
  dataFrames: DataFrame[];
  exploreId: ExploreId;
  range: TimeRange;
  splitOpen: typeof splitOpen;
}
export function UnconnectedServiceMapContainer(props: ServiceMapContainerProps) {
  const { dataFrames, range, splitOpen } = props;

  const { edges, nodes } = useMemo(
    () =>
      dataFrames.reduce(
        (acc, frame) => {
          const sourceField = frame.fields.filter(f => f.name === 'source');
          if (sourceField.length) {
            acc.edges.push(frame);
          } else {
            acc.nodes.push(frame);
          }
          return acc;
        },
        { edges: [], nodes: [] } as { nodes: DataFrame[]; edges: DataFrame[] }
      ),
    [dataFrames]
  );

  const getNodeLinks = useCallback(
    (node: ServiceMapNodeDatum) => {
      // TODO: maybe we can just scan all fields for links instead of hardcoding it here like this
      const field = nodes[0].fields.find(f => f.name === 'query');
      if (field) {
        return getFieldLinksForExplore({
          field: field!,
          rowIndex: node.dataFrameRowIndex,
          splitOpenFn: splitOpen,
          range,
        });
      } else {
        return [];
      }
    },
    [range, splitOpen, nodes[0]]
  );

  const getEdgeLinks = useCallback(
    (link: ServiceMapLinkDatum) => {
      // TODO: maybe we can just scan all fields for links instead of hardcoding it here like this
      const field = edges[0].fields.find(f => f.name === 'query');
      if (field) {
        return getFieldLinksForExplore({
          field: field!,
          rowIndex: link.dataFrameRowIndex,
          splitOpenFn: splitOpen,
          range,
        });
      } else {
        return [];
      }
    },
    [range, splitOpen, nodes[0]]
  );

  return <GraphView edges={edges[0]} services={nodes[0]} getNodeLinks={getNodeLinks} getEdgeLinks={getEdgeLinks} />;
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  return {
    range: state.explore[exploreId].range,
  };
}

const mapDispatchToProps = {
  splitOpen,
};

export const ServiceMapContainer = connect(mapStateToProps, mapDispatchToProps)(UnconnectedServiceMapContainer);
