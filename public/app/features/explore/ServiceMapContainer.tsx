import React from 'react';
import { GraphView } from '@grafana/ui/src/components/ServiceMap/GraphView';
import { DataFrame, TimeRange } from '@grafana/data';
import { ExploreId, StoreState } from '../../types';
import { splitOpen } from './state/main';
import { connect } from 'react-redux';
import { Collapse, useCategorizeFramesForGraph } from '@grafana/ui';
import { useLinks } from './utils/links';

interface ServiceMapContainerProps {
  // Edges and Nodes are separate frames
  dataFrames: DataFrame[];
  exploreId: ExploreId;
  range: TimeRange;
  splitOpen: typeof splitOpen;
}
export function UnconnectedServiceMapContainer(props: ServiceMapContainerProps) {
  const { dataFrames, range, splitOpen } = props;

  const { edges, nodes } = useCategorizeFramesForGraph(dataFrames);
  const getNodeLinks = useLinks(nodes[0], range, splitOpen);
  const getEdgeLinks = useLinks(edges[0], range, splitOpen);

  return (
    <Collapse label="Service Map" isOpen>
      <GraphView edges={edges[0]} services={nodes[0]} getNodeLinks={getNodeLinks} getEdgeLinks={getEdgeLinks} />
    </Collapse>
  );
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
