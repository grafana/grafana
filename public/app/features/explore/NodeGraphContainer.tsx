import React, { useState } from 'react';
import { Badge, Collapse } from '@grafana/ui';
import { DataFrame, TimeRange } from '@grafana/data';
import { ExploreId, StoreState } from '../../types';
import { splitOpen } from './state/main';
import { connect, ConnectedProps } from 'react-redux';
import { useLinks } from './utils/links';
import { NodeGraph } from '../../plugins/panel/nodeGraph';

interface Props {
  // Edges and Nodes are separate frames
  dataFrames: DataFrame[];
  exploreId: ExploreId;
  range: TimeRange;
  splitOpen: typeof splitOpen;
  short?: boolean;
}
export function UnconnectedNodeGraphContainer(props: Props & ConnectedProps<typeof connector>) {
  const { dataFrames, range, splitOpen, short } = props;
  const getLinks = useLinks(range, splitOpen);

  const [open, setOpen] = useState(true);

  return (
    <Collapse
      label={
        <span>
          Node graph <Badge text={'Beta'} color={'blue'} icon={'rocket'} tooltip={'This visualization is in beta'} />
        </span>
      }
      collapsible={short}
      isOpen={short ? open : true}
      onToggle={short ? () => setOpen(!open) : undefined}
    >
      <div style={{ height: short ? 300 : 600 }}>
        <NodeGraph dataFrames={dataFrames} getLinks={getLinks} />
      </div>
    </Collapse>
  );
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  return {
    range: state.explore[exploreId]!.range,
  };
}

const mapDispatchToProps = {
  splitOpen,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export const NodeGraphContainer = connector(UnconnectedNodeGraphContainer);
