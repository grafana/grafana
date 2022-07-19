import { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

import { Field } from '@grafana/data';

export interface NodeGraphOptions {
  nodes?: NodeOptions;
  edges?: EdgeOptions;
}

interface NodeOptions {
  mainStatUnit?: string;
  secondaryStatUnit?: string;
  arcs?: ArcOption[];
}

export interface ArcOption {
  field?: string;
  color?: string;
}

interface EdgeOptions {
  mainStatUnit?: string;
  secondaryStatUnit?: string;
}

export type NodeDatum = SimulationNodeDatum & {
  id: string;
  title: string;
  subTitle: string;
  dataFrameRowIndex: number;
  incoming: number;
  mainStat?: Field;
  secondaryStat?: Field;
  arcSections: Field[];
  color?: Field;
};

// This is the data we have before the graph is laid out with source and target being string IDs.
type LinkDatum = SimulationLinkDatum<NodeDatum> & {
  source: string;
  target: string;
};

// This is some additional data we expect with the edges.
export type EdgeDatum = LinkDatum & {
  id: string;
  mainStat: string;
  secondaryStat: string;
  dataFrameRowIndex: number;
};

// After layout is run D3 will change the string IDs for actual references to the nodes.
export type EdgeDatumLayout = EdgeDatum & {
  source: NodeDatum;
  target: NodeDatum;
};

export type NodesMarker = {
  node: NodeDatum;
  count: number;
};
