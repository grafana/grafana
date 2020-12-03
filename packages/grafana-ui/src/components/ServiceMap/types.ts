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

export interface XrayEdge {
  Aliases: string[];
  EndTime: number;
  ReferenceId: number;
  ResponseTimeHistogram: HistogramValue[];
  StartTime: number;
  SummaryStatistics: SummaryStatistics;
}

export interface XrayService {
  AccountId: string | null;
  DurationHistogram: HistogramValue[];
  Edges: XrayEdge[];
  EndTime: number;
  Name: string;
  Names: string[];
  ReferenceId: number;
  ResponseTimeHistogram: HistogramValue[];
  Root: true | null;
  StartTime: number;
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
};
