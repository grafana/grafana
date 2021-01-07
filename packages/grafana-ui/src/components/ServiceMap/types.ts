import { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { Stats } from './statsUtils';

interface HistogramValue {
  Count: number;
  Value: number;
}

interface SummaryStatistics {
  ErrorStatistics: { OtherCount: number; ThrottleCount: number; TotalCount: number };
  FaultStatistics: { OtherCount: number; TotalCount: number };
  OkCount: number;
  TotalCount: number;
  TotalResponseTime: number;
}

// TODO: move this to data source, we should not depend on data source specific metadata here
export interface XrayEdge {
  Aliases: string[];
  EndTime: number | string;
  ReferenceId: number;
  ResponseTimeHistogram: HistogramValue[];
  StartTime: number | string;
  SummaryStatistics: SummaryStatistics;
}

export interface XrayService {
  AccountId: string | null;
  DurationHistogram: HistogramValue[];
  Edges: XrayEdge[];
  EndTime: number | string;
  Name: string;
  Names: string[];
  ReferenceId: number;
  ResponseTimeHistogram: HistogramValue[];
  Root: true | null;
  StartTime: number | string;
  State: 'active' | 'unknown';
  SummaryStatistics: SummaryStatistics;
  Type: string;
}

export type NodeDatum = SimulationNodeDatum & {
  id: string;
  name: string;
  type: string;
  dataFrameRowIndex: number;
  incoming: number;
  stats?: Stats;
};
export type LinkDatum = SimulationLinkDatum<NodeDatum> & {
  stats?: Stats;
  dataFrameRowIndex: number;
};
