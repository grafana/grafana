import { PrometheusDatasource } from '../../../datasource';
import { PromVisualQuery } from '../../types';

export type MetricEncyclopediaProps = {
  datasource: PrometheusDatasource;
  isOpen: boolean;
  query: PromVisualQuery;
  onClose: () => void;
  onChange: (query: PromVisualQuery) => void;
};

export type MetricsData = MetricData[];

export type MetricData = {
  value: string;
  type?: string;
  description?: string;
};

export type PromFilterOption = {
  value: string;
  description: string;
};

export interface HaystackDictionary {
  [needle: string]: MetricData;
}

export type UFuzzyInfo = {
  idx: number[];
  start: number[];
  chars: number[];
  terms: number[];
  interIns: number[];
  intraIns: number[];
  interLft2: number[];
  interRgt2: number[];
  interLft1: number[];
  interRgt1: number[];
  ranges: number[][];
};
