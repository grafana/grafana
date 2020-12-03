import React, { useCallback } from 'react';
import { GraphView } from '@grafana/ui/src/components/ServiceMap/GraphView';
import { DataFrame, TimeRange } from '@grafana/data';
import { ExploreId, StoreState } from '../../types';
import { splitOpen } from './state/main';
import { connect } from 'react-redux';
import { ServiceMapNodeDatum } from '@grafana/ui';
import { getFieldLinksForExplore } from './utils/links';

interface ServiceMapContainerProps {
  dataFrame: DataFrame;
  exploreId: ExploreId;
  range: TimeRange;
  splitOpen: typeof splitOpen;
}
export function UnconnectedServiceMapContainer(props: ServiceMapContainerProps) {
  const { dataFrame, range, splitOpen } = props;

  const getLinks = useCallback(
    (node: ServiceMapNodeDatum) => {
      // For service map there should be only one field with nodes as json blob
      const field = dataFrame.fields[0];
      return getFieldLinksForExplore(field, node.dataFrameRowIndex, splitOpen, range, {
        __node: { value: { name: node.name, type: node.type }, text: '' },
      });
    },
    [range, splitOpen, dataFrame]
  );

  return <GraphView services={dataFrame.fields[0].values.toArray()} getLinks={getLinks} />;
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
